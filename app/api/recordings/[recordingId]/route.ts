import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase, getUploadBucket } from "@/lib/server/runtime";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  try {
    const { recordingId } = await params;
    await ensureDatabase();
    const database = getDatabase();
    const recording = await database
      .prepare(
        "SELECT storage_path AS storagePath FROM recordings WHERE id = ?",
      )
      .bind(recordingId)
      .first<{ storagePath: string }>();
    if (!recording) {
      return failure("RECORDING_NOT_FOUND", "录音不存在或已被删除。", 404);
    }

    await getUploadBucket().delete(recording.storagePath);
    await database
      .prepare("DELETE FROM recordings WHERE id = ?")
      .bind(recordingId)
      .run();
    return success({ id: recordingId }, "录音已删除");
  } catch (error) {
    logServerError("recording.delete.failed", error);
    return failure("DELETE_FAILED", "录音删除失败，请稍后重试。", 500);
  }
}
