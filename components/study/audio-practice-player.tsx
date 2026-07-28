"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Gauge,
  Languages,
  ListMusic,
  Pause,
  Play,
  Repeat1,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampSeekTime,
  formatAudioTime,
  getActiveLine,
  getPlayableRange,
} from "@/lib/audio";
import { cancelJapaneseSpeech, speakJapanese } from "@/lib/browser-speech";
import type { CourseTrackReference } from "@/lib/course-structure";
import type { DialogueLine, Lesson } from "@/lib/types";
import { Badge } from "../ui/badge";

type LoopMode = "none" | "line" | "dialogue";
type TranslationSize = "medium" | "large" | "xlarge";

interface PracticeTrackNavigation {
  currentTrackNumber: number;
  previousTrack?: CourseTrackReference;
  nextTrack?: CourseTrackReference;
}

interface TimingOverride {
  startMs: number;
  endMs: number;
}

interface TimingUpdatePayload {
  ok: boolean;
  data?: {
    updatedLines?: Array<{
      id: string;
      startMs: number;
      endMs: number;
    }>;
  };
  error?: { message?: string };
}

export function AudioPracticePlayer({
  lesson,
  clipPlayback = false,
  trackNavigation,
}: {
  lesson: Lesson;
  clipPlayback?: boolean;
  trackNavigation?: PracticeTrackNavigation;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const singleLinePlaybackRef = useRef<string | undefined>(undefined);
  const sourceLines = useMemo(
    () => lesson.dialogues.flatMap((dialogue) => dialogue.lines),
    [lesson.dialogues],
  );
  const [timingOverrides, setTimingOverrides] = useState<
    Record<string, TimingOverride>
  >({});
  const lines = useMemo(
    () =>
      sourceLines.map((line) => ({
        ...line,
        ...(timingOverrides[line.id] ?? {}),
      })),
    [sourceLines, timingOverrides],
  );
  const clipRange = useMemo(() => {
    if (!clipPlayback) {
      return undefined;
    }
    const first = getPlayableRange(lines[0]);
    const last = getPlayableRange(lines.at(-1));
    return first && last ? { start: first.start, end: last.end } : undefined;
  }, [clipPlayback, lines]);
  const scopeKey = lesson.dialogues.map((dialogue) => dialogue.id).join(":");
  const initialClipStart = clipPlayback
    ? getPlayableRange(sourceLines[0])?.start
    : undefined;
  const hasTimedLines = lines.some((line) => getPlayableRange(line));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    lesson.durationMs ? lesson.durationMs / 1_000 : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [loopMode, setLoopMode] = useState<LoopMode>("none");
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id);
  const [showJapanese, setShowJapanese] = useState(true);
  const [showReading, setShowReading] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [translationSize, setTranslationSize] =
    useState<TranslationSize>("large");
  const [error, setError] = useState<string>();
  const [calibrationStatus, setCalibrationStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [calibrationMessage, setCalibrationMessage] = useState<string>();

  const activeLine =
    lines.find((line) => line.id === activeLineId) ??
    getActiveLine(lines, currentTime) ??
    lines[0];
  const activeIndex = Math.max(
    0,
    lines.findIndex((line) => line.id === activeLine?.id),
  );
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem("translation-font-size");
      if (saved === "medium" || saved === "large" || saved === "xlarge") {
        setTranslationSize(saved);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("translation-font-size", translationSize);
  }, [translationSize]);

  const speakFallback = useCallback(
    async (line: DialogueLine) => {
      try {
        setError(undefined);
        setPlaying(true);
        await speakJapanese(line.text, { rate, volume });
      } catch (speechError) {
        setError(
          speechError instanceof Error
            ? speechError.message
            : "浏览器日语朗读失败。",
        );
      } finally {
        setPlaying(false);
      }
    },
    [rate, volume],
  );

  const seekToLine = useCallback(
    (line: DialogueLine, autoplay = false) => {
      const audio = audioRef.current;
      const range = getPlayableRange(line);
      setCalibrationStatus("idle");
      setCalibrationMessage(undefined);
      setActiveLineId(line.id);
      if (!lesson.audioUrl || !range) {
        singleLinePlaybackRef.current = undefined;
        audio?.pause();
        if (!lesson.audioUrl) {
          setCurrentTime(0);
        }
        if (autoplay) {
          void speakFallback(line);
        }
        if (lesson.audioUrl && !range) {
          setError(
            "单句时间轴尚未校准；单句播放使用浏览器朗读，底部播放键播放本课教材原音。",
          );
        } else {
          setError(undefined);
        }
        return;
      }
      if (!audio) {
        setError("这句台词还没有设置可播放的时间范围。");
        return;
      }
      setError(undefined);
      audio.currentTime = clampSeekTime(
        range.start,
        audio.duration || duration,
      );
      setCurrentTime(range.start);
      if (autoplay) {
        singleLinePlaybackRef.current = line.id;
        void audio.play().catch(() => {
          singleLinePlaybackRef.current = undefined;
          setError("浏览器阻止了自动播放，请点击播放按钮开始。");
        });
      } else {
        singleLinePlaybackRef.current = undefined;
      }
    },
    [duration, lesson.audioUrl, speakFallback],
  );

  const previousLine = useCallback(() => {
    const target = lines[Math.max(0, activeIndex - 1)];
    if (target) {
      seekToLine(target, playing);
    }
  }, [activeIndex, lines, playing, seekToLine]);

  const nextLine = useCallback(() => {
    const target = lines[Math.min(lines.length - 1, activeIndex + 1)];
    if (target) {
      seekToLine(target, playing);
    }
  }, [activeIndex, lines, playing, seekToLine]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!lesson.audioUrl) {
      if (window.speechSynthesis.speaking) {
        cancelJapaneseSpeech();
        setPlaying(false);
      } else if (activeLine) {
        await speakFallback(activeLine);
      }
      return;
    }
    if (!audio) {
      setError("音频播放器尚未准备好。");
      return;
    }
    try {
      setError(undefined);
      if (window.speechSynthesis.speaking) {
        cancelJapaneseSpeech();
      }
      if (audio.paused) {
        singleLinePlaybackRef.current = undefined;
        if (
          clipRange &&
          (audio.currentTime < clipRange.start ||
            audio.currentTime >= clipRange.end - 0.03)
        ) {
          audio.currentTime = clipRange.start;
          setCurrentTime(clipRange.start);
        }
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError("音频无法播放，请检查文件是否存在或点击后重试。");
    }
  }, [activeLine, clipRange, lesson.audioUrl, speakFallback]);

  const adjustActiveTiming = useCallback(
    async (boundary: "start" | "end", deltaMs: number) => {
      if (
        !activeLine ||
        activeLine.startMs === undefined ||
        activeLine.endMs === undefined
      ) {
        setCalibrationStatus("error");
        setCalibrationMessage("当前句还没有可校准的时间。");
        return;
      }

      const startMs =
        boundary === "start"
          ? Math.max(0, activeLine.startMs + deltaMs)
          : activeLine.startMs;
      const endMs =
        boundary === "end" ? activeLine.endMs + deltaMs : activeLine.endMs;
      if (endMs - startMs < 100) {
        setCalibrationStatus("error");
        setCalibrationMessage("单句至少保留 0.1 秒。");
        return;
      }

      setCalibrationStatus("saving");
      setCalibrationMessage("正在保存…");
      try {
        const response = await fetch(`/api/lines/${activeLine.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startMs, endMs }),
        });
        const payload = (await response.json()) as TimingUpdatePayload;
        if (!response.ok || !payload.ok || !payload.data?.updatedLines) {
          throw new Error(payload.error?.message ?? "时间保存失败。");
        }

        setTimingOverrides((current) => {
          const next = { ...current };
          for (const line of payload.data?.updatedLines ?? []) {
            next[line.id] = {
              startMs: line.startMs,
              endMs: line.endMs,
            };
          }
          return next;
        });
        setCalibrationStatus("saved");
        setCalibrationMessage("已保存，并重播当前句。");

        const audio = audioRef.current;
        if (audio && lesson.audioUrl) {
          audio.currentTime = startMs / 1_000;
          setCurrentTime(startMs / 1_000);
          singleLinePlaybackRef.current = activeLine.id;
          void audio.play().catch(() => {
            singleLinePlaybackRef.current = undefined;
            setError("浏览器阻止了自动播放，请点击“重播当前句”。");
          });
        }
      } catch (saveError) {
        setCalibrationStatus("error");
        setCalibrationMessage(
          saveError instanceof Error ? saveError.message : "时间保存失败。",
        );
      }
    },
    [activeLine, lesson.audioUrl],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTimingOverrides({});
      setCalibrationStatus("idle");
      setCalibrationMessage(undefined);
      setActiveLineId(sourceLines[0]?.id);
      singleLinePlaybackRef.current = undefined;
      const audio = audioRef.current;
      if (audio && initialClipStart !== undefined) {
        audio.currentTime = initialClipStart;
        setCurrentTime(initialClipStart);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialClipStart, scopeKey, sourceLines]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousLine();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextLine();
      } else if (event.key.toLowerCase() === "l") {
        setLoopMode((current) => (current === "line" ? "none" : "line"));
      } else if (event.key.toLowerCase() === "j") {
        setShowJapanese((current) => !current);
      } else if (event.key.toLowerCase() === "f") {
        setShowReading((current) => !current);
      } else if (event.key.toLowerCase() === "t") {
        setShowTranslation((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextLine, previousLine, togglePlay]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      cancelJapaneseSpeech();
    };
  }, [lesson.id]);

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const time = audio.currentTime;
    setCurrentTime(time);
    const detected = getActiveLine(lines, time);
    if (detected && detected.id !== activeLineId) {
      setActiveLineId(detected.id);
    }

    if (loopMode === "line") {
      const range = getPlayableRange(
        lines.find((line) => line.id === (detected?.id ?? activeLineId)),
      );
      if (range && time >= range.end - 0.03) {
        audio.currentTime = range.start;
        if (audio.paused) {
          void audio.play();
        }
      }
    } else if (singleLinePlaybackRef.current) {
      const range = getPlayableRange(
        lines.find((line) => line.id === singleLinePlaybackRef.current),
      );
      if (range && time >= range.end - 0.03) {
        singleLinePlaybackRef.current = undefined;
        audio.pause();
        audio.currentTime = range.end;
        setCurrentTime(range.end);
      }
    } else if (clipRange && time >= clipRange.end - 0.03) {
      if (loopMode === "dialogue") {
        audio.currentTime = clipRange.start;
        void audio.play();
      } else {
        audio.pause();
        audio.currentTime = clipRange.end;
        setCurrentTime(clipRange.end);
      }
    } else if (loopMode === "dialogue" && time >= audio.duration - 0.04) {
      audio.currentTime = 0;
      void audio.play();
    }
  }

  return (
    <div className="practice-layout" data-translation-size={translationSize}>
      <section className="practice-stage" aria-live="polite">
        {!lesson.audioUrl ? (
          <div className="notice notice-neutral" role="status">
            <Languages size={17} />
            <p>当前播放为浏览器合成的日语朗读，不是教材原音。</p>
          </div>
        ) : !hasTimedLines ? (
          <div className="notice notice-neutral" role="status">
            <Languages size={17} />
            <p>
              教材原音已关联：底部播放键播放整课原音；逐句播放暂用浏览器日语朗读。
            </p>
          </div>
        ) : null}
        <div className="practice-stage-top">
          <div>
            <p className="eyebrow">
              LINE {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(lines.length).padStart(2, "0")}
            </p>
            <Badge tone={activeLine?.speaker === "A" ? "speakerA" : "speakerB"}>
              SPEAKER {activeLine?.speaker}
            </Badge>
          </div>
          <div className="visibility-controls" aria-label="文本显示设置">
            <button
              type="button"
              className={showJapanese ? "toggle-chip active" : "toggle-chip"}
              aria-pressed={showJapanese}
              onClick={() => setShowJapanese((current) => !current)}
            >
              日文 J
            </button>
            <button
              type="button"
              className={showReading ? "toggle-chip active" : "toggle-chip"}
              aria-pressed={showReading}
              onClick={() => setShowReading((current) => !current)}
            >
              假名 F
            </button>
            <button
              type="button"
              className={showTranslation ? "toggle-chip active" : "toggle-chip"}
              aria-pressed={showTranslation}
              onClick={() => setShowTranslation((current) => !current)}
            >
              翻译 T
            </button>
            <button
              type="button"
              className="toggle-chip active"
              title="调整中文翻译字号"
              onClick={() =>
                setTranslationSize((current) =>
                  current === "medium"
                    ? "large"
                    : current === "large"
                      ? "xlarge"
                      : "medium",
                )
              }
            >
              译文字号{" "}
              {translationSize === "medium"
                ? "中"
                : translationSize === "large"
                  ? "大"
                  : "特大"}
            </button>
          </div>
        </div>

        <div className="current-line-card">
          {showJapanese ? (
            <p className="current-japanese">{activeLine?.text}</p>
          ) : (
            <p className="hidden-text-placeholder">日文已隐藏 · 按 J 显示</p>
          )}
          {showReading && activeLine?.reading ? (
            <p className="current-reading">{activeLine.reading}</p>
          ) : null}
          {showTranslation && activeLine?.translationZh ? (
            <p className="current-translation">{activeLine.translationZh}</p>
          ) : null}
        </div>

        <div className="line-navigation">
          <button
            className="button button-secondary"
            type="button"
            onClick={previousLine}
            disabled={activeIndex === 0}
          >
            <ChevronLeft size={17} />
            上一句
          </button>
          <div className="shortcut-hint">
            <span>Space 播放</span>
            <span>← → 换句</span>
            <span>L 循环</span>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={nextLine}
            disabled={activeIndex === lines.length - 1}
          >
            下一句
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="transcript-list" aria-label="课程台词">
          {lines.map((line, index) => (
            <button
              type="button"
              className={`transcript-line ${
                line.id === activeLine?.id ? "transcript-line-active" : ""
              } speaker-${line.speaker.toLowerCase()}`}
              key={line.id}
              onClick={() => seekToLine(line, true)}
              aria-current={line.id === activeLine?.id ? "true" : undefined}
            >
              <span className="transcript-order">{index + 1}</span>
              <Badge tone={line.speaker === "A" ? "speakerA" : "speakerB"}>
                {line.speaker}
              </Badge>
              <span className="transcript-copy">
                <strong>{line.text}</strong>
                <small>{line.translationZh}</small>
              </span>
              <span className="transcript-time">
                {line.startMs === undefined
                  ? "--:--"
                  : formatAudioTime(line.startMs / 1_000)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="practice-aside">
        <section className="surface practice-settings">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">PLAYBACK</p>
              <h2>播放设置</h2>
            </div>
            <ListMusic size={19} />
          </div>
          <label>
            <span>
              <Gauge size={15} /> 播放速度
            </span>
            <select
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            >
              <option value={0.6}>0.6× 慢速</option>
              <option value={0.75}>0.75×</option>
              <option value={0.9}>0.9×</option>
              <option value={1}>1.0× 正常</option>
              <option value={1.1}>1.1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5× 快速</option>
            </select>
          </label>
          <label>
            <span>
              <Volume2 size={15} /> 音量
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="播放音量"
            />
          </label>
          <div className="loop-options">
            <button
              className={
                loopMode === "line" ? "option-button active" : "option-button"
              }
              type="button"
              aria-pressed={loopMode === "line"}
              disabled={!hasTimedLines}
              onClick={() =>
                setLoopMode((current) => (current === "line" ? "none" : "line"))
              }
            >
              <Repeat1 size={16} />{" "}
              {hasTimedLines ? "单句循环" : "单句循环（待校准）"}
            </button>
            <button
              className={
                loopMode === "dialogue"
                  ? "option-button active"
                  : "option-button"
              }
              type="button"
              aria-pressed={loopMode === "dialogue"}
              onClick={() =>
                setLoopMode((current) =>
                  current === "dialogue" ? "none" : "dialogue",
                )
              }
            >
              <RotateCcw size={16} /> 整段循环
            </button>
          </div>
        </section>

        {activeLine?.startMs !== undefined && activeLine.endMs !== undefined ? (
          <section className="surface calibration-card">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">CALIBRATION</p>
                <h2>校准当前句</h2>
              </div>
              <span className="calibration-line-number">
                第 {activeIndex + 1} 句
              </span>
            </div>
            <div className="calibration-times" aria-label="当前句时间">
              <span>
                <small>开始</small>
                <strong>{formatCalibrationTime(activeLine.startMs)}</strong>
              </span>
              <span>
                <small>结束</small>
                <strong>{formatCalibrationTime(activeLine.endMs)}</strong>
              </span>
            </div>
            <div className="calibration-controls">
              <button
                type="button"
                disabled={calibrationStatus === "saving"}
                onClick={() => void adjustActiveTiming("start", -100)}
              >
                开头提前 0.1 秒
              </button>
              <button
                type="button"
                disabled={calibrationStatus === "saving"}
                onClick={() => void adjustActiveTiming("start", 100)}
              >
                开头延后 0.1 秒
              </button>
              <button
                type="button"
                disabled={calibrationStatus === "saving"}
                onClick={() => void adjustActiveTiming("end", -100)}
              >
                结尾提前 0.1 秒
              </button>
              <button
                type="button"
                disabled={calibrationStatus === "saving"}
                onClick={() => void adjustActiveTiming("end", 100)}
              >
                结尾延后 0.1 秒
              </button>
            </div>
            <button
              className="button button-secondary calibration-replay"
              type="button"
              onClick={() => seekToLine(activeLine, true)}
            >
              <RotateCcw size={15} />
              重播当前句
            </button>
            {calibrationMessage ? (
              <p
                className={`calibration-status calibration-status-${calibrationStatus}`}
                role={calibrationStatus === "error" ? "alert" : "status"}
              >
                {calibrationMessage}
              </p>
            ) : (
              <p className="calibration-help">
                听到开头或结尾不准时，每次微调 0.1 秒。
              </p>
            )}
          </section>
        ) : null}

        {trackNavigation ? (
          <section className="surface practice-track-card">
            <div>
              <p className="eyebrow">TRACK NAVIGATION</p>
              <h2>切换 Track</h2>
              <span>当前 Track {trackNavigation.currentTrackNumber}</span>
            </div>
            <div className="practice-track-buttons">
              {trackNavigation.previousTrack ? (
                <Link
                  className="button button-secondary"
                  href={practiceTrackHref(trackNavigation.previousTrack)}
                  rel="prev"
                >
                  <ChevronLeft size={17} />
                  <span>
                    <small>上一个</small>
                    Track {trackNavigation.previousTrack.number}
                  </span>
                </Link>
              ) : (
                <span
                  className="button button-secondary disabled"
                  aria-disabled="true"
                >
                  <ChevronLeft size={17} />
                  <span>
                    <small>上一个</small>
                    已到开头
                  </span>
                </span>
              )}
              {trackNavigation.nextTrack ? (
                <Link
                  className="button button-secondary next"
                  href={practiceTrackHref(trackNavigation.nextTrack)}
                  rel="next"
                >
                  <span>
                    <small>下一个</small>
                    Track {trackNavigation.nextTrack.number}
                  </span>
                  <ChevronRight size={17} />
                </Link>
              ) : (
                <span
                  className="button button-secondary next disabled"
                  aria-disabled="true"
                >
                  <span>
                    <small>下一个</small>
                    已到结尾
                  </span>
                  <ChevronRight size={17} />
                </span>
              )}
            </div>
          </section>
        ) : null}
      </aside>

      <div className="player-dock">
        <audio
          ref={audioRef}
          src={lesson.audioUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration);
            if (clipRange) {
              event.currentTarget.currentTime = clipRange.start;
              setCurrentTime(clipRange.start);
            }
            setError(undefined);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            singleLinePlaybackRef.current = undefined;
            setPlaying(false);
          }}
          onError={() =>
            setError("音频加载失败，请确认文件存在且浏览器支持此格式。")
          }
        />
        {error ? (
          <div className="player-error" role="alert">
            <CircleAlert size={16} />
            {error}
          </div>
        ) : null}
        <div className="player-main">
          <div className="player-line-summary">
            <Badge tone={activeLine?.speaker === "A" ? "speakerA" : "speakerB"}>
              {activeLine?.speaker}
            </Badge>
            <span>{activeLine?.text}</span>
          </div>
          <div className="player-transport">
            <button
              className="transport-button"
              type="button"
              onClick={previousLine}
              aria-label="上一句"
            >
              <ChevronLeft size={21} />
            </button>
            <button
              className="play-button"
              type="button"
              onClick={() => void togglePlay()}
              aria-label={playing ? "暂停音频" : "播放音频"}
            >
              {playing ? (
                <Pause size={23} fill="currentColor" />
              ) : (
                <Play size={23} fill="currentColor" />
              )}
            </button>
            <button
              className="transport-button"
              type="button"
              onClick={nextLine}
              aria-label="下一句"
            >
              <ChevronRight size={21} />
            </button>
          </div>
          <div className="player-rate">
            <Languages size={16} />
            {rate.toFixed(rate === 1 ? 1 : 2).replace(/0$/, "")}×
          </div>
        </div>
        <div className="seek-row">
          <time>{formatAudioTime(currentTime)}</time>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.01}
            value={Math.min(currentTime, Math.max(duration, 0.01))}
            onChange={(event) => {
              const audio = audioRef.current;
              if (!audio) {
                return;
              }
              const next = Number(event.target.value);
              audio.currentTime = next;
              setCurrentTime(next);
            }}
            aria-label="音频播放进度"
            style={
              {
                "--seek-progress": `${duration ? (currentTime / duration) * 100 : 0}%`,
              } as React.CSSProperties
            }
          />
          <time>{formatAudioTime(duration)}</time>
        </div>
      </div>
    </div>
  );
}

function practiceTrackHref(track: CourseTrackReference) {
  return `/practice/${track.lessonId}?dialogue=${track.id}`;
}

function formatCalibrationTime(milliseconds: number) {
  return `${(milliseconds / 1_000).toFixed(2)} 秒`;
}
