import { describe, expect, it, vi } from "vitest";
import { MockMediaRecorder } from "../mocks/media-recorder";

describe("MediaRecorder test double", () => {
  it("emits a deterministic Blob without a real microphone", () => {
    const recorder = new MockMediaRecorder({} as MediaStream, {
      mimeType: "audio/webm",
    });
    const onData = vi.fn();
    const onStop = vi.fn();
    recorder.ondataavailable = onData;
    recorder.onstop = onStop;
    recorder.start();
    recorder.stop();
    expect(onData).toHaveBeenCalledOnce();
    expect(onData.mock.calls[0][0].data).toBeInstanceOf(Blob);
    expect(onStop).toHaveBeenCalledOnce();
  });
});
