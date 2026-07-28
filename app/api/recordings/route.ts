import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase, getUploadBucket } from "@/lib/server/runtime";

const maxRecordingBytes = 25 * 1024 * 1024;
const recordingMimeTypes = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/wav",
  "audio/x-wav",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const durationMs = Number(formData.get("durationMs") ?? 0);
    if (!(file instanceof File) || file.size === 0) {
      return failure("RECORDING_REQUIRED", "没有收到有效的录音文件。", 422);
    }
    if (!recordingMimeTypes.has(file.type.toLowerCase())) {
      return failure(
        "UNSUPPORTED_RECORDING",
        "浏览器生成的录音格式不受支持。",
        415,
      );
    }
    if (file.size > maxRecordingBytes) {
      return failure(
        "RECORDING_TOO_LARGE",
        "录音超过 25 MB，请缩短后重试。",
        413,
      );
    }
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return failure("INVALID_DURATION", "录音时长无效。", 422);
    }

    await ensureDatabase();
    const id = crypto.randomUUID();
    const extension = file.type.includes("mp4")
      ? "m4a"
      : file.type.includes("ogg")
        ? "ogg"
        : file.type.includes("wav")
          ? "wav"
          : "webm";
    const storagePath = `recordings/${id}.${extension}`;
    await getUploadBucket().put(storagePath, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { createdBy: "shadowing-coach" },
    });

    await getDatabase()
      .prepare(
        `INSERT INTO recordings
          (id, practice_session_id, storage_path, mime_type, size_bytes, duration_ms, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        storagePath,
        file.type,
        file.size,
        Math.round(durationMs),
        new Date().toISOString(),
      )
      .run();

    return success(
      {
        id,
        url: `/api/files/${encodeURIComponent(storagePath)}`,
        storagePath,
      },
      "录音已保存",
      { status: 201 },
    );
  } catch (error) {
    logServerError("recording.upload.failed", error);
    return failure("RECORDING_SAVE_FAILED", "录音保存失败，请稍后重试。", 500);
  }
}
