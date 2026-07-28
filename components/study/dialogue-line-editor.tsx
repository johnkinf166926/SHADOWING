"use client";

import { Check, Pencil, Save, Scissors, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import type { Speaker } from "@/lib/types";

export function DialogueLineEditor({
  dialogueId,
  lineId,
  lineOrder,
  initialSpeaker,
  initialText,
  initialReading,
  initialTranslation,
}: {
  dialogueId: string;
  lineId: string;
  lineOrder: number;
  initialSpeaker: Speaker;
  initialText: string;
  initialReading?: string;
  initialTranslation?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [speaker, setSpeaker] = useState(initialSpeaker);
  const [savedSpeaker, setSavedSpeaker] = useState(initialSpeaker);
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [translation, setTranslation] = useState(initialTranslation ?? "");
  const [savedTranslation, setSavedTranslation] = useState(
    initialTranslation ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [nextSpeaker, setNextSpeaker] = useState<Speaker>(
    initialSpeaker === "A" ? "B" : "A",
  );
  const [nextText, setNextText] = useState("");
  const [nextTranslation, setNextTranslation] = useState("");
  const [error, setError] = useState<string>();

  function cancel() {
    setSpeaker(savedSpeaker);
    setText(savedText);
    setTranslation(savedTranslation);
    resetSplit();
    setEditing(false);
    setError(undefined);
  }

  function resetSplit() {
    setSplitting(false);
    setNextSpeaker(savedSpeaker === "A" ? "B" : "A");
    setNextText("");
    setNextTranslation("");
  }

  async function save() {
    const currentText = text.trim();
    if (!currentText) {
      setError("日文原文不能为空。");
      return;
    }
    if (splitting && !nextText.trim()) {
      setError("拆分后的下一句不能为空。");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      if (splitting) {
        const response = await fetch(
          `/api/lines/${encodeURIComponent(lineId)}/split`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              current: {
                speaker,
                text: currentText,
                translationZh: translation.trim(),
              },
              next: {
                speaker: nextSpeaker,
                text: nextText.trim(),
                translationZh: nextTranslation.trim(),
              },
            }),
          },
        );
        const result = (await response.json()) as ApiResponse<{
          current: {
            id: string;
            speaker: Speaker;
            text: string;
            translationZh: string;
          };
        }>;
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        setSpeaker(result.data.current.speaker);
        setSavedSpeaker(result.data.current.speaker);
        setText(result.data.current.text);
        setSavedText(result.data.current.text);
        setTranslation(result.data.current.translationZh);
        setSavedTranslation(result.data.current.translationZh);
        resetSplit();
      } else {
        const response = await fetch(
          `/api/lines/${encodeURIComponent(lineId)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              speaker,
              text: currentText,
              translationZh: translation.trim(),
            }),
          },
        );
        const result = (await response.json()) as ApiResponse<{
          id: string;
          speaker: Speaker;
          text: string;
          translationZh: string;
        }>;
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        setSpeaker(result.data.speaker);
        setSavedSpeaker(result.data.speaker);
        setText(result.data.text);
        setSavedText(result.data.text);
        setTranslation(result.data.translationZh);
        setSavedTranslation(result.data.translationZh);
      }
      setEditing(false);
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "原文保存失败，请重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function splitIntoNextTrack() {
    if (
      !window.confirm(
        "要从这句开始建立新的 Track 吗？这句以及后面的台词都会移动到下一个 Track。",
      )
    ) {
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/dialogues/${encodeURIComponent(dialogueId)}/split`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lineId }),
        },
      );
      const result = (await response.json()) as ApiResponse<{
        newDialogue: {
          id: string;
        };
      }>;
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      router.push(`/tracks/${result.data.newDialogue.id}`);
      router.refresh();
    } catch (splitError) {
      setError(
        splitError instanceof Error
          ? splitError.message
          : "Track 拆分失败，请重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="dialogue-line-display">
        <div className="dialogue-line-copy">
          <p className="dialogue-japanese">{savedText}</p>
          {initialReading ? (
            <p className="dialogue-reading">{initialReading}</p>
          ) : null}
          <p
            className={`dialogue-translation ${
              savedTranslation ? "" : "dialogue-translation-empty"
            }`}
          >
            {savedTranslation || "暂无中文翻译"}
          </p>
        </div>
        <button
          className="line-edit-trigger"
          type="button"
          aria-label="修改这句日文原文和中文翻译"
          title="修改原文和中文翻译"
          onClick={() => {
            setEditing(true);
            setSaved(false);
          }}
        >
          <Pencil size={14} />
          修改
        </button>
        {saved ? (
          <span className="line-save-confirmation" role="status">
            <Check size={13} />
            已保存
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="dialogue-line-editor">
      <label htmlFor={`line-speaker-${lineId}`}>说话人</label>
      <select
        id={`line-speaker-${lineId}`}
        value={speaker}
        disabled={saving}
        onChange={(event) => setSpeaker(event.target.value as Speaker)}
      >
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="NARRATOR">旁白</option>
      </select>
      <label htmlFor={`line-text-${lineId}`}>日文原文</label>
      <textarea
        id={`line-text-${lineId}`}
        lang="ja"
        rows={3}
        maxLength={2_000}
        autoFocus
        value={text}
        disabled={saving}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
      <label htmlFor={`line-translation-${lineId}`}>中文翻译</label>
      <textarea
        id={`line-translation-${lineId}`}
        className="dialogue-translation-input"
        lang="zh-CN"
        rows={3}
        maxLength={4_000}
        placeholder="输入中文翻译；也可以留空后继续补充"
        value={translation}
        disabled={saving}
        onChange={(event) => setTranslation(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
      {!splitting ? (
        <button
          className="line-split-trigger"
          type="button"
          disabled={saving}
          onClick={() => {
            setSplitting(true);
            setNextSpeaker(speaker === "A" ? "B" : "A");
          }}
        >
          <Scissors size={14} />
          从这里拆分并新增下一句
        </button>
      ) : (
        <div className="dialogue-split-panel">
          <div className="dialogue-split-heading">
            <strong>新增下一句</strong>
            <button type="button" disabled={saving} onClick={resetSplit}>
              取消拆分
            </button>
          </div>
          <label htmlFor={`next-speaker-${lineId}`}>下一句说话人</label>
          <select
            id={`next-speaker-${lineId}`}
            value={nextSpeaker}
            disabled={saving}
            onChange={(event) => setNextSpeaker(event.target.value as Speaker)}
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="NARRATOR">旁白</option>
          </select>
          <label htmlFor={`next-text-${lineId}`}>下一句日文原文</label>
          <textarea
            id={`next-text-${lineId}`}
            lang="ja"
            rows={3}
            maxLength={2_000}
            value={nextText}
            disabled={saving}
            onChange={(event) => setNextText(event.target.value)}
          />
          <label htmlFor={`next-translation-${lineId}`}>下一句中文翻译</label>
          <textarea
            id={`next-translation-${lineId}`}
            className="dialogue-translation-input"
            lang="zh-CN"
            rows={3}
            maxLength={4_000}
            value={nextTranslation}
            disabled={saving}
            onChange={(event) => setNextTranslation(event.target.value)}
          />
          <small>保存后会先平分两句音频，再到听读练习微调边界。</small>
        </div>
      )}
      {lineOrder > 1 ? (
        <div className="dialogue-track-split">
          <button
            type="button"
            disabled={saving}
            onClick={() => void splitIntoNextTrack()}
          >
            <Scissors size={14} />
            从此句开始新 Track
          </button>
          <small>这句及后面的台词会整体移到下一个 Track。</small>
        </div>
      ) : null}
      <div className="dialogue-edit-footer">
        <small>Ctrl + Enter 保存 · Esc 取消</small>
        <div>
          <button
            className="button button-ghost"
            type="button"
            disabled={saving}
            onClick={cancel}
          >
            <X size={14} />
            取消
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={saving || !text.trim() || (splitting && !nextText.trim())}
            onClick={() => void save()}
          >
            <Save size={14} />
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="dialogue-edit-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
