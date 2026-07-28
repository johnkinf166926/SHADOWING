import { failure } from "@/lib/api-response";
import { logServerError } from "@/lib/server/database";
import { getUploadBucket } from "@/lib/server/runtime";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key } = await params;
    const objectKey = key.map(decodeURIComponent).join("/");
    if (
      !objectKey ||
      objectKey.includes("..") ||
      objectKey.startsWith("/") ||
      objectKey.includes("\\")
    ) {
      return failure("INVALID_PATH", "文件路径无效。", 400);
    }

    const object = await getUploadBucket().get(objectKey, {
      range: request.headers,
    });
    if (!object) {
      return failure("FILE_NOT_FOUND", "音频文件不存在或已被移除。", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, max-age=3600");
    if (object.range) {
      const responseRange = getResponseRange(
        request.headers.get("range"),
        object.size,
      );
      if (responseRange) {
        headers.set(
          "content-range",
          `bytes ${responseRange.start}-${responseRange.end}/${object.size}`,
        );
      }
    }
    return new Response(object.body, {
      status: object.range ? 206 : 200,
      headers,
    });
  } catch (error) {
    logServerError("file.read.failed", error);
    return failure("FILE_READ_FAILED", "音频加载失败，请稍后重试。", 500);
  }
}

function getResponseRange(rangeHeader: string | null, size: number) {
  const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/u);
  if (!match || size <= 0) {
    return undefined;
  }

  const [, startText, endText] = match;
  if (!startText && !endText) {
    return undefined;
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return undefined;
    }
    return {
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    };
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : size - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  ) {
    return undefined;
  }

  return {
    start,
    end: Math.min(requestedEnd, size - 1),
  };
}
