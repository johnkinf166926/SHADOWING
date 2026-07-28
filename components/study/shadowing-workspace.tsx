"use client";

import {
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Clock3,
  Layers3,
  Mic2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Lesson, PracticeMode } from "@/lib/types";
import { Badge } from "../ui/badge";
import { RecordingPanel } from "./recording-panel";

const modes: Array<{
  value: PracticeMode;
  label: string;
  description: string;
}> = [
  { value: "FULL", label: "全部跟读", description: "A 与 B 连续练习" },
  { value: "SPEAKER_A", label: "只练 A", description: "聚焦 A 的台词" },
  { value: "SPEAKER_B", label: "只练 B", description: "聚焦 B 的台词" },
  { value: "DELAYED", label: "延迟跟读", description: "听完后再开口" },
  { value: "SINGLE_LINE", label: "单句练习", description: "逐句精练" },
  { value: "FULL_DIALOGUE", label: "整段练习", description: "完成整组对话" },
];

export function ShadowingWorkspace({ lesson }: { lesson: Lesson }) {
  const [mode, setMode] = useState<PracticeMode>("SINGLE_LINE");
  const allLines = useMemo(
    () => lesson.dialogues.flatMap((dialogue) => dialogue.lines),
    [lesson.dialogues],
  );
  const lines = useMemo(() => {
    if (mode === "SPEAKER_A") {
      return allLines.filter((line) => line.speaker === "A");
    }
    if (mode === "SPEAKER_B") {
      return allLines.filter((line) => line.speaker === "B");
    }
    return allLines;
  }, [allLines, mode]);
  const [lineIndex, setLineIndex] = useState(0);
  const safeIndex = Math.min(lineIndex, Math.max(0, lines.length - 1));
  const line = lines[safeIndex] ?? allLines[0];
  const dialogue = lesson.dialogues.find((candidate) =>
    candidate.lines.some((candidateLine) => candidateLine.id === line?.id),
  );

  if (!line) {
    return <p className="muted">这节课程还没有可练习的台词。</p>;
  }

  return (
    <div className="shadowing-layout">
      <section className="shadowing-mode-bar" aria-label="Shadowing 模式">
        {modes.map((item) => (
          <button
            className={mode === item.value ? "mode-pill active" : "mode-pill"}
            type="button"
            aria-pressed={mode === item.value}
            key={item.value}
            onClick={() => {
              setMode(item.value);
              setLineIndex(0);
            }}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
          </button>
        ))}
      </section>

      <div className="shadowing-columns">
        <section className="shadowing-prompt surface">
          <div className="shadowing-prompt-top">
            <div>
              <p className="eyebrow">
                SHADOWING · LINE {safeIndex + 1} / {lines.length}
              </p>
              <Badge tone={line.speaker === "A" ? "speakerA" : "speakerB"}>
                <UserRound size={12} />
                SPEAKER {line.speaker}
              </Badge>
            </div>
            <span className="reference-time">
              <Clock3 size={14} />
              {line.startMs !== undefined && line.endMs !== undefined
                ? `${((line.endMs - line.startMs) / 1_000).toFixed(1)} 秒`
                : "未设置区间"}
            </span>
          </div>
          <div className="shadowing-line">
            <p>{line.text}</p>
            <span>{line.reading}</span>
            <small>{line.translationZh}</small>
          </div>
          <div className="shadowing-nav">
            <button
              className="button button-secondary"
              type="button"
              disabled={safeIndex === 0}
              onClick={() =>
                setLineIndex((current) => Math.max(0, current - 1))
              }
            >
              <ChevronLeft size={17} />
              上一句
            </button>
            <span>
              {mode === "DELAYED" ? (
                <>
                  <CirclePlay size={15} /> 原音后延迟 1.2 秒
                </>
              ) : mode === "FULL_DIALOGUE" ? (
                <>
                  <Layers3 size={15} /> 整段顺序练习
                </>
              ) : (
                <>
                  <Mic2 size={15} /> 听一遍，再录一遍
                </>
              )}
            </span>
            <button
              className="button button-secondary"
              type="button"
              disabled={safeIndex === lines.length - 1}
              onClick={() =>
                setLineIndex((current) =>
                  Math.min(lines.length - 1, current + 1),
                )
              }
            >
              下一句
              <ChevronRight size={17} />
            </button>
          </div>
        </section>

        <section className="surface">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">RECORD & COMPARE</p>
              <h2>录音对比</h2>
            </div>
            <Mic2 size={20} />
          </div>
          <RecordingPanel
            key={`${mode}-${line.id}`}
            lessonId={lesson.id}
            dialogueId={dialogue?.id}
            line={line}
            mode={mode}
            audioUrl={lesson.audioUrl}
          />
        </section>
      </div>
    </div>
  );
}
