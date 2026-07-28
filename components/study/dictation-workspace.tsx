"use client";

import {
  AlertCircle,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gauge,
  Headphones,
  Lightbulb,
  ListPlus,
  Play,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import { speakJapanese } from "@/lib/browser-speech";
import { evaluateDictation, type DictationResult } from "@/lib/text";
import type { Lesson } from "@/lib/types";
import { Badge } from "../ui/badge";

export function DictationWorkspace({ lesson }: { lesson: Lesson }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lines = useMemo(
    () => lesson.dialogues.flatMap((dialogue) => dialogue.lines),
    [lesson.dialogues],
  );
  const [lineIndex, setLineIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<DictationResult>();
  const [ignorePunctuation, setIgnorePunctuation] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addedToReview, setAddedToReview] = useState(false);
  const [error, setError] = useState<string>();
  const line = lines[lineIndex];

  async function playLine(rate = 1) {
    const audio = audioRef.current;
    if (
      !lesson.audioUrl ||
      !audio ||
      line.startMs === undefined ||
      line.endMs === undefined
    ) {
      try {
        setError(undefined);
        await speakJapanese(line.text, { rate });
      } catch (speechError) {
        setError(
          speechError instanceof Error
            ? speechError.message
            : "浏览器日语朗读失败。",
        );
      }
      return;
    }
    setError(undefined);
    audio.playbackRate = rate;
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
      setError("浏览器未允许播放，请再次点击播放按钮。");
    }
  }

  async function checkAnswer() {
    if (!answer.trim()) {
      setError("请先输入你听到的日文。");
      return;
    }
    const evaluated = evaluateDictation(line.text, answer, {
      ignorePunctuation,
    });
    setResult(evaluated);
    setShowAnswer(false);
    setError(undefined);
    try {
      const response = await fetch("/api/dictation-attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          lineId: line.id,
          answer,
          normalized: evaluated.actualNormalized,
          accuracy: evaluated.accuracy,
          correct: evaluated.correct,
          diff: evaluated.diff,
          addedToReview,
        }),
      });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      setSaved(payload.ok);
      if (!payload.ok) {
        setError(payload.error.message);
      }
    } catch {
      setError("答案已在页面中检查，但保存失败，请恢复连接后重试。");
    }
  }

  function moveLine(direction: -1 | 1) {
    setLineIndex((current) =>
      Math.max(0, Math.min(lines.length - 1, current + direction)),
    );
    setAnswer("");
    setResult(undefined);
    setShowHint(false);
    setShowAnswer(false);
    setSaved(false);
    setAddedToReview(false);
    setError(undefined);
  }

  if (!line) {
    return <p className="muted">这节课程还没有可用于听写的台词。</p>;
  }

  return (
    <div className="dictation-layout">
      <audio
        ref={audioRef}
        src={lesson.audioUrl}
        onError={() => setError("音频加载失败，请检查课程音频。")}
      />
      <section className="dictation-card surface">
        <div className="dictation-topbar">
          <div>
            <p className="eyebrow">
              SENTENCE {lineIndex + 1} / {lines.length}
            </p>
            <Badge tone={line.speaker === "A" ? "speakerA" : "speakerB"}>
              SPEAKER {line.speaker}
            </Badge>
          </div>
          <div className="dictation-audio-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void playLine()}
            >
              <Play size={16} fill="currentColor" />
              播放单句
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void playLine(0.7)}
            >
              <Gauge size={16} />
              0.7×
            </button>
          </div>
        </div>

        <div className="dictation-prompt">
          <Headphones size={28} />
          <h2>听清以后，输入你听到的日文</h2>
          <p>默认隐藏原文；汉字与假名、平假名与片假名不会自动视为相同。</p>
          {showHint ? (
            <div className="hint-box">
              <Lightbulb size={15} />
              <span>
                读音提示：
                {line.reading?.slice(
                  0,
                  Math.max(2, Math.ceil((line.reading?.length ?? 0) / 3)),
                )}
                …
              </span>
            </div>
          ) : null}
        </div>

        <label className="dictation-input">
          <span>你的答案</span>
          <textarea
            rows={4}
            value={answer}
            disabled={Boolean(result)}
            lang="ja"
            placeholder="ここに日本語を入力してください…"
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>

        <div className="dictation-options">
          <label>
            <input
              type="checkbox"
              checked={ignorePunctuation}
              disabled={Boolean(result)}
              onChange={(event) => setIgnorePunctuation(event.target.checked)}
            />
            比较时忽略标点
          </label>
          <label>
            <input
              type="checkbox"
              checked={addedToReview}
              disabled={Boolean(result)}
              onChange={(event) => setAddedToReview(event.target.checked)}
            />
            <ListPlus size={15} />
            加入错题本
          </label>
          <button
            className="text-button"
            type="button"
            onClick={() => setShowHint((current) => !current)}
          >
            <Lightbulb size={14} />
            {showHint ? "隐藏提示" : "查看提示"}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => setShowAnswer(true)}
          >
            <Eye size={14} />
            查看答案
          </button>
        </div>

        {showAnswer ? (
          <div className="answer-reveal">
            <span>正确答案</span>
            <strong>{line.text}</strong>
            <small>{line.reading}</small>
          </div>
        ) : null}

        {error ? (
          <div className="notice notice-error" role="alert">
            <AlertCircle size={17} />
            <p>{error}</p>
          </div>
        ) : null}

        {!result ? (
          <button
            className="button button-primary dictation-check"
            type="button"
            onClick={() => void checkAnswer()}
          >
            <BookOpenCheck size={17} />
            检查答案
          </button>
        ) : null}
      </section>

      {result ? (
        <section
          className={`surface dictation-result ${
            result.correct ? "result-correct" : "result-needs-work"
          }`}
          aria-live="polite"
        >
          <div className="result-heading">
            <span className="result-icon">
              {result.correct ? <Check size={24} /> : <X size={24} />}
            </span>
            <div>
              <p className="eyebrow">
                {result.correct ? "CORRECT" : "KEEP GOING"}
              </p>
              <h2>{result.correct ? "完全正确！" : "再看一遍差异"}</h2>
              <p>
                正确率 {result.accuracy.toFixed(1)}% ·{" "}
                {saved ? "结果已保存" : "正在等待保存"}
              </p>
            </div>
            <strong className="accuracy-ring">
              {Math.round(result.accuracy)}%
            </strong>
          </div>

          <div className="diff-legend">
            <span className="diff-equal">正确</span>
            <span className="diff-replace">错误</span>
            <span className="diff-missing">缺少</span>
            <span className="diff-extra">多余</span>
          </div>

          <div className="diff-display" aria-label="字符级差异">
            {result.diff.map((item, index) => (
              <span
                className={`diff-char diff-${item.kind}`}
                key={`${item.kind}-${index}`}
                title={
                  item.kind === "replace"
                    ? `应为「${item.expected}」，输入了「${item.actual}」`
                    : undefined
                }
              >
                {item.kind === "replace" ? (
                  <>
                    <del>{item.actual}</del>
                    <ins>{item.expected}</ins>
                  </>
                ) : item.kind === "missing" ? (
                  <ins>{item.expected}</ins>
                ) : item.kind === "extra" ? (
                  <del>{item.actual}</del>
                ) : (
                  item.actual
                )}
              </span>
            ))}
          </div>

          <div className="diff-stats">
            <span>
              <b>{result.correctCharacters}</b> 正确字符
            </span>
            <span>
              <b>{result.wrongCharacters}</b> 错误字符
            </span>
            <span>
              <b>{result.missingCharacters}</b> 缺少字符
            </span>
            <span>
              <b>{result.extraCharacters}</b> 多余字符
            </span>
          </div>

          <div className="result-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setResult(undefined);
                setSaved(false);
              }}
            >
              <RotateCcw size={16} />
              再写一次
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void playLine()}
            >
              <Headphones size={16} />
              再听一次
            </button>
          </div>
        </section>
      ) : (
        <aside className="dictation-side surface">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>听写小提示</h2>
          <ol>
            <li>
              <span>1</span>
              先用正常速度听完整句子
            </li>
            <li>
              <span>2</span>
              写出听到的汉字、假名和助词
            </li>
            <li>
              <span>3</span>
              查看字符差异，再降速确认
            </li>
          </ol>
          <div className="dictation-nav">
            <button
              className="icon-button"
              type="button"
              aria-label="上一句"
              disabled={lineIndex === 0}
              onClick={() => moveLine(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <span>
              {lineIndex + 1} / {lines.length}
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label="下一句"
              disabled={lineIndex === lines.length - 1}
              onClick={() => moveLine(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </aside>
      )}

      {result ? (
        <div className="dictation-next-row">
          <button
            className="button button-primary"
            type="button"
            disabled={lineIndex === lines.length - 1}
            onClick={() => moveLine(1)}
          >
            下一句
            <ChevronRight size={17} />
          </button>
          {saved ? (
            <span>
              <Save size={14} /> 学习记录已保存
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
