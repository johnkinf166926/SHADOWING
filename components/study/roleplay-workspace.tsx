"use client";

import {
  AlertCircle,
  Check,
  ChevronRight,
  Eye,
  Lightbulb,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import { cancelJapaneseSpeech, speakJapanese } from "@/lib/browser-speech";
import {
  selectRecordingMimeType,
  supportsRecording,
} from "@/lib/media-recorder";
import type { DialogueLine, Lesson, PracticeMode, Speaker } from "@/lib/types";
import { Badge } from "../ui/badge";

type RoleMode = "A" | "B" | "RANDOM";
type ChallengeState = "idle" | "running" | "complete";

interface LineAttempt {
  lineId: string;
  url: string;
  blob: Blob;
  durationMs: number;
}

export function RoleplayWorkspace({ lesson }: { lesson: Lesson }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelledRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const lines = useMemo(
    () => lesson.dialogues.flatMap((dialogue) => dialogue.lines),
    [lesson.dialogues],
  );
  const [roleMode, setRoleMode] = useState<RoleMode>("B");
  const [resolvedRole, setResolvedRole] = useState<Speaker>("B");
  const [waitSeconds, setWaitSeconds] = useState(4);
  const [state, setState] = useState<ChallengeState>("idle");
  const [lineIndex, setLineIndex] = useState(0);
  const [countdown, setCountdown] = useState<number>();
  const [attempts, setAttempts] = useState<LineAttempt[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [showFirst, setShowFirst] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState<string>();
  const currentLine = lines[Math.min(lineIndex, lines.length - 1)];

  useEffect(() => {
    const urls = urlsRef.current;
    const audio = audioRef.current;
    return () => {
      cancelledRef.current = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      audio?.pause();
      cancelJapaneseSpeech();
    };
  }, []);

  async function runChallenge() {
    if (!lines.length) {
      return;
    }
    if (!supportsRecording()) {
      setError("当前浏览器不支持自动录音，无法开始应答练习。");
      return;
    }
    cancelledRef.current = false;
    setError(undefined);
    setAttempts([]);
    setShowHint(false);
    setShowFirst(false);
    setShowAnswer(false);
    setState("running");
    const randomByte = window.crypto.getRandomValues(new Uint8Array(1))[0];
    const role: Speaker =
      roleMode === "RANDOM" ? (randomByte % 2 === 0 ? "A" : "B") : roleMode;
    setResolvedRole(role);
    const startedDate = new Date();
    const startedAt = startedDate.toISOString();
    const startedMs = startedDate.getTime();
    const collected: LineAttempt[] = [];

    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (cancelledRef.current) {
          return;
        }
        setLineIndex(index);
        setShowHint(false);
        setShowFirst(false);
        setShowAnswer(false);
        const line = lines[index];
        if (line.speaker === role) {
          for (let remaining = waitSeconds; remaining > 0; remaining -= 1) {
            setCountdown(remaining);
            await wait(1_000);
            if (cancelledRef.current) {
              return;
            }
          }
          setCountdown(0);
          const attempt = await recordForLine(
            line,
            Math.max(
              waitSeconds * 1_000,
              (line.endMs ?? 0) - (line.startMs ?? 0) + 1_000,
            ),
          );
          collected.push(attempt);
          urlsRef.current.push(attempt.url);
          setAttempts([...collected]);
        } else {
          setCountdown(undefined);
          await playLine(line);
        }
        await wait(280);
      }

      setCountdown(undefined);
      setState("complete");
      const practiceMode: PracticeMode =
        roleMode === "RANDOM"
          ? "ROLEPLAY_RANDOM"
          : role === "A"
            ? "ROLEPLAY_A"
            : "ROLEPLAY_B";
      const response = await fetch("/api/practice-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          dialogueId: lesson.dialogues[0]?.id,
          mode: practiceMode,
          startedAt,
          durationMs: Math.round(new Date().getTime() - startedMs),
          completed: true,
          note: `角色应答：${role}`,
        }),
      });
      const result = (await response.json()) as ApiResponse<{ id: string }>;
      if (!result.ok) {
        setError(result.error.message);
      }
    } catch (challengeError) {
      setState("idle");
      setCountdown(undefined);
      setError(
        challengeError instanceof Error
          ? challengeError.message
          : "应答练习中断，请重新挑战。",
      );
    }
  }

  async function playLine(line: DialogueLine) {
    const audio = audioRef.current;
    if (
      !lesson.audioUrl ||
      !audio ||
      line.startMs === undefined ||
      line.endMs === undefined
    ) {
      await speakJapanese(line.text);
      return;
    }
    const player = audio;
    player.currentTime = line.startMs / 1_000;
    const end = line.endMs / 1_000;
    await player.play();
    await new Promise<void>((resolve) => {
      const fallback = window.setTimeout(
        finish,
        Math.max(800, (end - player.currentTime) * 1_000 + 500),
      );
      function finish() {
        window.clearTimeout(fallback);
        player.pause();
        player.removeEventListener("timeupdate", onTime);
        resolve();
      }
      function onTime() {
        if (player.currentTime >= end || cancelledRef.current) {
          finish();
        }
      }
      player.addEventListener("timeupdate", onTime);
    });
  }

  async function recordForLine(
    line: DialogueLine,
    durationMs: number,
  ): Promise<LineAttempt> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error("没有麦克风权限，请允许访问后重新挑战。");
    }
    const mimeType = selectRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    const started = performance.now();
    const blob = await new Promise<Blob>((resolve, reject) => {
      const stopTimer = window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, durationMs);
      recorder.onstop = () => {
        window.clearTimeout(stopTimer);
        resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.onerror = () => {
        window.clearTimeout(stopTimer);
        reject(new Error("自动录音失败，请重新挑战。"));
      };
      recorder.start(200);
    });
    stream.getTracks().forEach((track) => track.stop());
    return {
      lineId: line.id,
      blob,
      url: URL.createObjectURL(blob),
      durationMs: Math.round(performance.now() - started),
    };
  }

  function stopChallenge() {
    cancelledRef.current = true;
    audioRef.current?.pause();
    cancelJapaneseSpeech();
    setState("idle");
    setCountdown(undefined);
  }

  const isUserTurn =
    state === "running" && currentLine?.speaker === resolvedRole;

  return (
    <div className="roleplay-layout">
      <audio
        ref={audioRef}
        src={lesson.audioUrl}
        onError={() => setError("课程音频加载失败。")}
      />
      <section className="surface roleplay-settings">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">ROLE</p>
            <h2>选择你的角色</h2>
          </div>
          <UsersRound size={20} />
        </div>
        <div className="role-options">
          {(
            [
              ["A", "扮演 A", UserRound],
              ["B", "扮演 B", UserRound],
              ["RANDOM", "随机角色", Shuffle],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              className={
                roleMode === value ? "role-option active" : "role-option"
              }
              type="button"
              aria-pressed={roleMode === value}
              key={value}
              disabled={state === "running"}
              onClick={() => setRoleMode(value)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <label className="wait-setting">
          <span>回答等待时间</span>
          <select
            value={waitSeconds}
            disabled={state === "running"}
            onChange={(event) => setWaitSeconds(Number(event.target.value))}
          >
            {[2, 3, 4, 5, 6, 8].map((seconds) => (
              <option value={seconds} key={seconds}>
                {seconds} 秒
              </option>
            ))}
          </select>
        </label>
        <div className="roleplay-help">
          <Lightbulb size={15} />
          对方台词正常播放；轮到你时原音静音并自动录音。
        </div>
      </section>

      <section className="surface roleplay-stage">
        <div className="roleplay-progress">
          <span>
            LINE {Math.min(lineIndex + 1, lines.length)} / {lines.length}
          </span>
          <div>
            {lines.map((line, index) => (
              <i
                className={
                  index < lineIndex
                    ? "done"
                    : index === lineIndex && state === "running"
                      ? "active"
                      : ""
                }
                key={line.id}
              />
            ))}
          </div>
        </div>

        {state === "idle" ? (
          <div className="roleplay-idle">
            <span className="roleplay-mark">受</span>
            <h2>准备好以后，开始一轮完整对话</h2>
            <p>系统会自动播放、停顿、录音并进入下一句。</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void runChallenge()}
            >
              <Play size={17} fill="currentColor" />
              开始挑战
            </button>
          </div>
        ) : state === "running" ? (
          <div className={`roleplay-turn ${isUserTurn ? "user-turn" : ""}`}>
            <Badge tone={currentLine.speaker === "A" ? "speakerA" : "speakerB"}>
              SPEAKER {currentLine.speaker}
            </Badge>
            {isUserTurn ? (
              <>
                <div className="response-countdown">
                  {countdown && countdown > 0 ? (
                    <>
                      <strong>{countdown}</strong>
                      <span>准备回答</span>
                    </>
                  ) : (
                    <>
                      <Mic2 size={35} />
                      <span>正在录音 · 请说出台词</span>
                    </>
                  )}
                </div>
                <div className="roleplay-hints">
                  <button
                    type="button"
                    onClick={() => setShowHint((current) => !current)}
                  >
                    <Lightbulb size={14} /> 提示
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFirst((current) => !current)}
                  >
                    首字
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAnswer((current) => !current)}
                  >
                    <Eye size={14} /> 完整答案
                  </button>
                </div>
                {showHint ? (
                  <p className="roleplay-hint-text">{currentLine.reading}</p>
                ) : null}
                {showFirst ? (
                  <p className="roleplay-first">
                    {Array.from(currentLine.text)[0]}…
                  </p>
                ) : null}
                {showAnswer ? (
                  <p className="roleplay-answer">{currentLine.text}</p>
                ) : null}
              </>
            ) : (
              <div className="partner-turn">
                <Play size={26} />
                <span>正在播放对方台词</span>
                <p>{currentLine.text}</p>
              </div>
            )}
            <button
              className="button button-ghost"
              type="button"
              onClick={stopChallenge}
            >
              <Pause size={16} />
              暂停挑战
            </button>
          </div>
        ) : (
          <div className="roleplay-complete">
            <span className="complete-mark">
              <Check size={27} />
            </span>
            <h2>完成！角色 {resolvedRole}</h2>
            <p>已记录 {attempts.length} 个回答，可以逐句回放。</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void runChallenge()}
            >
              <RotateCcw size={16} />
              重新挑战
            </button>
          </div>
        )}

        {error ? (
          <div className="notice notice-error" role="alert">
            <AlertCircle size={17} />
            <p>{error}</p>
          </div>
        ) : null}
      </section>

      {state === "complete" ? (
        <section className="surface roleplay-review">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">REVIEW</p>
              <h2>逐句回放</h2>
            </div>
            <Badge tone="success">{attempts.length} 条录音</Badge>
          </div>
          <div className="roleplay-attempts">
            {lines.map((line) => {
              const attempt = attempts.find((item) => item.lineId === line.id);
              return (
                <article key={line.id}>
                  <Badge tone={line.speaker === "A" ? "speakerA" : "speakerB"}>
                    {line.speaker}
                  </Badge>
                  <div>
                    <strong>{line.text}</strong>
                    <small>{line.translationZh}</small>
                  </div>
                  {attempt ? (
                    <audio src={attempt.url} controls preload="metadata" />
                  ) : (
                    <span className="partner-label">
                      对方台词 <ChevronRight size={13} />
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
