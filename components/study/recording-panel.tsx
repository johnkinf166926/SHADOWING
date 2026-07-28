"use client";

import {
  AlertCircle,
  Check,
  CircleStop,
  Clock3,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import { formatAudioTime } from "@/lib/audio";
import { speakJapanese } from "@/lib/browser-speech";
import {
  fallbackWaveform,
  readWaveform,
  selectRecordingMimeType,
  supportsRecording,
} from "@/lib/media-recorder";
import type { DialogueLine, PracticeMode } from "@/lib/types";
import { Waveform } from "./waveform";

interface SavedRecording {
  id: string;
  url: string;
  storagePath: string;
}

type RecorderState =
  | "idle"
  | "requesting"
  | "countdown"
  | "recording"
  | "processing"
  | "ready"
  | "saved";

export function RecordingPanel({
  lessonId,
  dialogueId,
  line,
  mode,
  audioUrl,
}: {
  lessonId: string;
  dialogueId?: string;
  line: DialogueLine;
  mode: PracticeMode;
  audioUrl?: string;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<RecorderState>("idle");
  const [countdown, setCountdown] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob>();
  const [recordingUrl, setRecordingUrl] = useState<string>();
  const [savedRecording, setSavedRecording] = useState<SavedRecording>();
  const [waveform, setWaveform] = useState<number[]>(fallbackWaveform());
  const [referencePlaying, setReferencePlaying] = useState(false);
  const [recordingPlaying, setRecordingPlaying] = useState(false);
  const [error, setError] = useState<string>();
  const [scores, setScores] = useState({
    pronunciation: 4,
    rhythm: 4,
    fluency: 4,
  });
  const [note, setNote] = useState("");

  const referenceDurationMs =
    line.startMs !== undefined && line.endMs !== undefined
      ? line.endMs - line.startMs
      : undefined;
  const timingHint = useMemo(() => {
    if (!recordingBlob || !referenceDurationMs || elapsedMs <= 0) {
      return "录音后会显示与参考台词时长的简单比较。";
    }
    const ratio = elapsedMs / referenceDurationMs;
    if (ratio < 0.78) {
      return "你的录音明显短于原音；可以留意是否省略了助词或句尾。";
    }
    if (ratio > 1.28) {
      return "你的录音比原音长；先保持清晰，再尝试缩短句中停顿。";
    }
    return "录音时长接近原音。下一步重点比较停顿和句尾语调。";
  }, [elapsedMs, recordingBlob, referenceDurationMs]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (state === "recording") {
      stopRecording();
      return;
    }
    if (!supportsRecording()) {
      setError(
        "当前浏览器不支持录音，请更新浏览器或改用支持 MediaRecorder 的浏览器。",
      );
      return;
    }

    setError(undefined);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setState("countdown");
      for (let value = 3; value > 0; value -= 1) {
        setCountdown(value);
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 700);
        });
      }

      const mimeType = selectRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setError("录音过程中出现错误，请重新录制。");
        setState("idle");
        releaseStream();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setRecordingUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return url;
        });
        setState("processing");
        void readWaveform(blob).then((values) => {
          setWaveform(values);
          setState("ready");
        });
        releaseStream();
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = performance.now();
      setElapsedMs(0);
      recorder.start(250);
      setState("recording");
    } catch (recordingError) {
      releaseStream();
      setState("idle");
      if (
        recordingError instanceof DOMException &&
        (recordingError.name === "NotAllowedError" ||
          recordingError.name === "PermissionDeniedError")
      ) {
        setError("没有麦克风权限。请在浏览器地址栏允许麦克风后重试。");
      } else {
        setError("无法启动录音，请确认麦克风未被其他程序占用。");
      }
    }
  }, [releaseStream, state, stopRecording]);

  useEffect(() => {
    if (state !== "recording") {
      return;
    }
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== undefined) {
        setElapsedMs(performance.now() - startedAtRef.current);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        void startRecording();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startRecording]);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
      releaseStream();
    };
  }, [recordingUrl, releaseStream]);

  async function playReference() {
    const audio = audioRef.current;
    if (
      !audioUrl ||
      !audio ||
      line.startMs === undefined ||
      line.endMs === undefined
    ) {
      try {
        setError(undefined);
        setReferencePlaying(true);
        await speakJapanese(line.text);
      } catch (speechError) {
        setError(
          speechError instanceof Error
            ? speechError.message
            : "浏览器日语朗读失败。",
        );
      } finally {
        setReferencePlaying(false);
      }
      return;
    }
    audio.currentTime = line.startMs / 1_000;
    const end = line.endMs / 1_000;
    const stopAtEnd = () => {
      if (audio.currentTime >= end) {
        audio.pause();
        audio.removeEventListener("timeupdate", stopAtEnd);
      }
    };
    audio.addEventListener("timeupdate", stopAtEnd);
    try {
      await audio.play();
    } catch {
      setError("原音播放失败，请先点击页面后重试。");
    }
  }

  async function uploadRecording(): Promise<SavedRecording | undefined> {
    if (!recordingBlob) {
      return undefined;
    }
    const formData = new FormData();
    const extension = recordingBlob.type.includes("mp4")
      ? "m4a"
      : recordingBlob.type.includes("ogg")
        ? "ogg"
        : "webm";
    formData.append(
      "file",
      new File([recordingBlob], `recording-${Date.now()}.${extension}`, {
        type: recordingBlob.type,
      }),
    );
    formData.append("durationMs", String(Math.round(elapsedMs)));
    const response = await fetch("/api/recordings", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as ApiResponse<SavedRecording>;
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    setSavedRecording(result.data);
    return result.data;
  }

  async function saveSession() {
    if (!recordingBlob) {
      return;
    }
    setError(undefined);
    setState("processing");
    try {
      const uploaded = savedRecording ?? (await uploadRecording());
      const response = await fetch("/api/practice-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lessonId,
          dialogueId,
          lineId: line.id,
          mode,
          startedAt: new Date().toISOString(),
          durationMs: Math.round(elapsedMs),
          recordingPath: uploaded?.storagePath,
          selfPronunciationScore: scores.pronunciation,
          selfRhythmScore: scores.rhythm,
          selfFluencyScore: scores.fluency,
          note,
          completed: true,
          startedWithinTarget: true,
        }),
      });
      const result = (await response.json()) as ApiResponse<{ id: string }>;
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      setState("saved");
    } catch (saveError) {
      setState("ready");
      setError(
        saveError instanceof Error
          ? saveError.message
          : "练习记录保存失败，请重试。",
      );
    }
  }

  async function deleteRecording() {
    if (savedRecording) {
      try {
        await fetch(`/api/recordings/${savedRecording.id}`, {
          method: "DELETE",
        });
      } catch {
        setError("服务器端录音删除失败；本地预览已清除。");
      }
    }
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    setRecordingBlob(undefined);
    setRecordingUrl(undefined);
    setSavedRecording(undefined);
    setElapsedMs(0);
    setWaveform(fallbackWaveform());
    setState("idle");
  }

  return (
    <div className="recording-panel">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setReferencePlaying(true)}
        onPause={() => setReferencePlaying(false)}
        onError={() => setError("原音加载失败，请检查课程音频。")}
      />

      <div className="recording-primary">
        {state === "countdown" ? (
          <div className="countdown-display" aria-live="assertive">
            <strong>{countdown}</strong>
            <span>准备开口</span>
          </div>
        ) : (
          <button
            className={`record-button ${state === "recording" ? "recording" : ""}`}
            type="button"
            onClick={() => void startRecording()}
            disabled={state === "requesting" || state === "processing"}
            aria-label={state === "recording" ? "停止录音" : "开始录音"}
          >
            {state === "recording" ? (
              <CircleStop size={27} fill="currentColor" />
            ) : (
              <Mic2 size={27} />
            )}
          </button>
        )}
        <div>
          <strong>
            {state === "recording"
              ? "正在录音"
              : state === "requesting"
                ? "正在请求麦克风"
                : state === "processing"
                  ? "正在处理录音"
                  : state === "saved"
                    ? "练习已保存"
                    : recordingBlob
                      ? "录音已完成"
                      : "按下开始录音"}
          </strong>
          <span>
            {state === "recording" ? (
              <>
                <i className="recording-dot" />{" "}
                {formatAudioTime(elapsedMs / 1_000)}
              </>
            ) : (
              "快捷键 R · 录音前会倒计时 3 秒"
            )}
          </span>
        </div>
      </div>

      {error ? (
        <div className="notice notice-error" role="alert">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="waveform-comparison">
        <article>
          <div className="waveform-heading">
            <span>{audioUrl ? "教材原音" : "浏览器朗读"}</span>
            <button
              className="waveform-play"
              type="button"
              onClick={() => void playReference()}
              aria-label={audioUrl ? "播放教材原音" : "播放浏览器日语朗读"}
            >
              {referencePlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
          <Waveform
            values={fallbackWaveform()}
            label={audioUrl ? "教材原音波形" : "浏览器朗读示意"}
            tone="reference"
          />
          <small>
            <Clock3 size={12} />
            {referenceDurationMs
              ? `${(referenceDurationMs / 1_000).toFixed(1)} 秒`
              : audioUrl
                ? "未设置区间"
                : "合成朗读"}
          </small>
        </article>
        <article className={!recordingBlob ? "waveform-disabled" : ""}>
          <div className="waveform-heading">
            <span>我的录音</span>
            <button
              className="waveform-play"
              type="button"
              disabled={!recordingUrl}
              onClick={(event) => {
                const recordingAudio = event.currentTarget
                  .closest("article")
                  ?.querySelector("audio");
                if (recordingAudio) {
                  if (recordingAudio.paused) {
                    void recordingAudio.play();
                  } else {
                    recordingAudio.pause();
                  }
                }
              }}
              aria-label="播放我的录音"
            >
              {recordingPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
          <audio
            src={recordingUrl}
            onPlay={() => setRecordingPlaying(true)}
            onPause={() => setRecordingPlaying(false)}
            onEnded={() => setRecordingPlaying(false)}
          />
          <Waveform values={waveform} label="我的录音波形" tone="recording" />
          <small>
            <Clock3 size={12} />
            {recordingBlob
              ? `${(elapsedMs / 1_000).toFixed(1)} 秒`
              : "等待录音"}
          </small>
        </article>
      </div>

      {recordingBlob ? (
        <>
          <div className="rhythm-hint">
            <Clock3 size={16} />
            <div>
              <strong>节奏提示</strong>
              <p>{timingHint}</p>
            </div>
          </div>

          <div className="self-rating">
            <h3>
              完成自评 <small>1–5 分</small>
            </h3>
            {(
              [
                ["pronunciation", "发音"],
                ["rhythm", "节奏"],
                ["fluency", "流畅度"],
              ] as const
            ).map(([key, label]) => (
              <div className="rating-row" key={key}>
                <span>{label}</span>
                <div>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      className={
                        scores[key] === score ? "score active" : "score"
                      }
                      type="button"
                      aria-label={`${label} ${score} 分`}
                      aria-pressed={scores[key] === score}
                      key={score}
                      onClick={() =>
                        setScores((current) => ({ ...current, [key]: score }))
                      }
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <label>
              <span>练习笔记</span>
              <textarea
                value={note}
                rows={2}
                maxLength={2_000}
                placeholder="例如：句尾语调需要更轻一些"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>

          <div className="recording-actions">
            <button
              className="button button-danger"
              type="button"
              onClick={() => void deleteRecording()}
            >
              <Trash2 size={16} />
              删除重录
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void startRecording()}
            >
              <RotateCcw size={16} />
              重新录音
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={state === "processing" || state === "saved"}
              onClick={() => void saveSession()}
            >
              {state === "saved" ? <Check size={16} /> : <Save size={16} />}
              {state === "saved" ? "已保存" : "保存练习"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
