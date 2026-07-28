param(
  [string]$SourceDirectory = "private_content/ocr/crops-japanese",
  [string]$OutputDirectory = "private_content/ocr/windows-japanese",
  [string]$LanguageTag = "ja"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]

function Await-Result {
  param(
    [Parameter(Mandatory = $true)]$Operation,
    [Parameter(Mandatory = $true)][Type]$ResultType
  )

  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq "AsTask" -and
      $_.IsGenericMethod -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } |
    Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

$sourcePath = (Resolve-Path $SourceDirectory).Path
$outputPath = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
[IO.Directory]::CreateDirectory($outputPath) | Out-Null
$language = [Windows.Globalization.Language]::new($LanguageTag)
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) {
  throw "Windows OCR does not support language $LanguageTag."
}
$utf8 = [Text.UTF8Encoding]::new($false)

Get-ChildItem -LiteralPath $sourcePath -Filter "page-*.jpg" |
  Sort-Object Name |
  ForEach-Object {
    $file = Await-Result (
      [Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)
    ) ([Windows.Storage.StorageFile])
    $stream = Await-Result (
      $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    ) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-Result (
      [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    ) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Result (
      $decoder.GetSoftwareBitmapAsync()
    ) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-Result (
      $engine.RecognizeAsync($bitmap)
    ) ([Windows.Media.Ocr.OcrResult])

    $lines = @(
      $result.Lines | ForEach-Object {
        @{
          text = $_.Text
          words = @(
            $_.Words | ForEach-Object {
              @{
                text = $_.Text
                x = [Math]::Round($_.BoundingRect.X, 2)
                y = [Math]::Round($_.BoundingRect.Y, 2)
                width = [Math]::Round($_.BoundingRect.Width, 2)
                height = [Math]::Round($_.BoundingRect.Height, 2)
              }
            }
          )
        }
      }
    )
    $payload = @{
      language = $LanguageTag
      page = [int]$_.BaseName.Substring(5)
      text = $result.Text
      lines = $lines
    }
    $json = $payload | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText(
      (Join-Path $outputPath "$($_.BaseName).json"),
      $json,
      $utf8
    )
    [IO.File]::WriteAllText(
      (Join-Path $outputPath "$($_.BaseName).txt"),
      $result.Text,
      $utf8
    )
    $bitmap.Dispose()
    $stream.Dispose()
    Write-Output (
      $payload |
        Select-Object page, language, @{Name = "characters"; Expression = { $_.text.Length } } |
        ConvertTo-Json -Compress
    )
  }
