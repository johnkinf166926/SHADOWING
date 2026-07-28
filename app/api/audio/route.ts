import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase, getUploadBucket } from "@/lib/server/runtime";

const maxAudioBytes = 80 * 1024 * 1024;
const allowedExtensions = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "webm",
  "flac",
]);
const allowedMimeTypes = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return failure("FILE_REQUIRED", "请选择要上传的音频文件。", 422);
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !allowedExtensions.has(extension) ||
      !allowedMimeTypes.has(file.type.toLowerCase())
    ) {
      return failure(
        "UNSUPPORTED_AUDIO",
        "不支持此音频格式。请使用 MP3、WAV、M4A、AAC、OGG、WebM 或 FLAC。",
        415,
      );
    }
    if (file.size > maxAudioBytes) {
      return failure(
        "FILE_TOO_LARGE",
        "音频文件超过 80 MB，请压缩后再上传。",
        413,
      );
    }
    const lessonIdValue = formData.get("lessonId");
    const lessonId =
      typeof lessonIdValue === "string" && lessonIdValue.trim()
        ? lessonIdValue.trim()
        : undefined;
    const durationValue = formData.get("durationMs");
    const durationMs =
      typeof durationValue === "string" &&
      Number.isFinite(Number(durationValue)) &&
      Number(durationValue) > 0
        ? Math.round(Number(durationValue))
        : undefined;

    await ensureDatabase();
    const database = getDatabase();
    if (lessonId) {
      const lesson = await database
        .prepare("SELECT id FROM lessons WHERE id = ?")
        .bind(lessonId)
        .first<{ id: string }>();
      if (!lesson) {
        return failure("LESSON_NOT_FOUND", "找不到要关联的课程。", 404);
      }
    }
    const bucket = getUploadBucket();
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const storagePath = `audio/${id}-${safeName}`;
    await bucket.put(storagePath, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name },
    });

    const statements = [
      database
        .prepare(
          `INSERT INTO audio_assets
          (id, filename, storage_path, mime_type, size_bytes, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          file.name,
          storagePath,
          file.type,
          file.size,
          durationMs ?? null,
          new Date().toISOString(),
        ),
    ];
    if (lessonId) {
      statements.push(
        database
          .prepare(
            `UPDATE lessons
             SET audio_asset_id = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(id, new Date().toISOString(), lessonId),
      );
    }
    await database.batch(statements);

    return success(
      {
        id,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        durationMs,
        lessonId,
        url: `/api/files/${encodeURIComponent(storagePath)}`,
      },
      "音频上传完成",
      { status: 201 },
    );
  } catch (error) {
    logServerError("audio.upload.failed", error);
    return failure(
      "UPLOAD_FAILED",
      "音频保存失败，请检查网络或本地存储空间后重试。",
      500,
    );
  }
}
