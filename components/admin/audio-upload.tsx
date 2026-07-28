"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileAudio2,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";

type UploadState =
  | { state: "idle" }
  | { state: "uploading"; filename: string }
  | { state: "success"; filename: string; message: string }
  | { state: "error"; message: string };

export function AudioUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadState>({ state: "idle" });

  async function upload(file: File) {
    setStatus({ state: "uploading", filename: file.name });
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/audio", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ApiResponse<{
        id: string;
        filename: string;
      }>;
      if (!result.ok) {
        setStatus({ state: "error", message: result.error.message });
        return;
      }
      setStatus({
        state: "success",
        filename: result.data.filename,
        message: result.message ?? "音频上传完成。",
      });
    } catch {
      setStatus({
        state: "error",
        message: "无法连接到本地存储服务，请检查是否离线。",
      });
    }
  }

  return (
    <div className="audio-upload-panel">
      <div className="audio-upload-copy">
        <span className="dropzone-icon">
          <FileAudio2 size={25} />
        </span>
        <div>
          <h3>上传课程音频</h3>
          <p>支持 MP3、WAV、M4A、AAC、OGG、WebM、FLAC，单个不超过 80 MB。</p>
        </div>
      </div>
      <button
        className="button button-primary"
        type="button"
        disabled={status.state === "uploading"}
        onClick={() => inputRef.current?.click()}
      >
        {status.state === "uploading" ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Upload size={17} />
        )}
        {status.state === "uploading" ? "正在上传" : "选择音频"}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,audio/*"
        aria-label="选择课程音频"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />

      {status.state === "success" ? (
        <div className="notice notice-success" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{status.filename}</strong>
            <p>{status.message} 现在可以在课程编辑中关联此音频。</p>
          </div>
        </div>
      ) : null}
      {status.state === "error" ? (
        <div className="notice notice-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>上传失败</strong>
            <p>{status.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
