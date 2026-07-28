"use client";

import { AlertCircle, CheckCircle2, FileJson2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import {
  parseCsvContent,
  validateContent,
  type ContentValidationResult,
} from "@/lib/content-validation";

type ImportStatus =
  | { state: "idle" }
  | { state: "ready"; validation: ContentValidationResult; content: unknown }
  | {
      state: "importing";
      validation: ContentValidationResult;
      content: unknown;
    }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>({ state: "idle" });
  const [dragActive, setDragActive] = useState(false);

  async function readFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ state: "error", message: "导入文件不能超过 5 MB。" });
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "json" && extension !== "csv") {
      setStatus({
        state: "error",
        message: "仅支持 UTF-8 编码的 JSON 或 CSV 文件。",
      });
      return;
    }

    try {
      const text = await file.text();
      const content: unknown =
        extension === "csv" ? parseCsvContent(text) : JSON.parse(text);
      const validation = validateContent(content);
      setStatus({ state: "ready", validation, content });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof Error
            ? `文件解析失败：${error.message}`
            : "文件解析失败，请检查格式。",
      });
    }
  }

  async function importContent(
    validation: ContentValidationResult,
    content: unknown,
  ) {
    if (!validation.success) {
      return;
    }
    setStatus({ state: "importing", validation, content });
    try {
      const response = await fetch("/api/content/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(content),
      });
      const result = (await response.json()) as ApiResponse<{
        unitId: string;
      }>;
      if (!result.ok) {
        setStatus({ state: "error", message: result.error.message });
        return;
      }
      setStatus({
        state: "success",
        message: result.message ?? "教材内容已成功导入。",
      });
    } catch {
      setStatus({
        state: "error",
        message: "导入请求失败。离线时请恢复连接后重试。",
      });
    }
  }

  const validation =
    status.state === "ready" || status.state === "importing"
      ? status.validation
      : undefined;

  return (
    <div className="import-panel">
      <div
        className={`dropzone ${dragActive ? "dropzone-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files[0];
          if (file) {
            void readFile(file);
          }
        }}
      >
        <span className="dropzone-icon">
          <FileJson2 size={25} />
        </span>
        <h3>拖入教材结构文件</h3>
        <p>支持 JSON 与 CSV；文件仅在你确认后写入数据库。</p>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={16} />
          选择文件
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".json,.csv,application/json,text/csv"
          aria-label="选择教材 JSON 或 CSV 文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void readFile(file);
            }
          }}
        />
      </div>

      {validation ? (
        <section className="import-preview" aria-live="polite">
          <div className="import-preview-header">
            <div>
              <h3>导入预览</h3>
              <p>
                {validation.summary.lessons} 课程 ·{" "}
                {validation.summary.dialogues} 对话 · {validation.summary.lines}{" "}
                台词 · {validation.summary.expressions} 表达
              </p>
            </div>
            <span
              className={
                validation.success
                  ? "validation-status valid"
                  : "validation-status invalid"
              }
            >
              {validation.success ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              {validation.success ? "校验通过" : "需要修正"}
            </span>
          </div>

          {validation.issues.length > 0 ? (
            <ul className="validation-issues">
              {validation.issues.map((issue, index) => (
                <li
                  className={`validation-${issue.severity}`}
                  key={`${issue.path}-${index}`}
                >
                  <span>{issue.severity === "error" ? "错误" : "警告"}</span>
                  <div>
                    <code>{issue.path || "root"}</code>
                    <p>{issue.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="validation-empty">没有发现格式或时间范围问题。</p>
          )}

          <div className="import-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setStatus({ state: "idle" })}
            >
              取消
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={!validation.success || status.state === "importing"}
              onClick={() => {
                if (status.state === "ready") {
                  void importContent(status.validation, status.content);
                }
              }}
            >
              {status.state === "importing" ? "正在导入…" : "确认导入"}
            </button>
          </div>
        </section>
      ) : null}

      {status.state === "success" ? (
        <div className="notice notice-success" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>导入完成</strong>
            <p>{status.message}</p>
          </div>
        </div>
      ) : null}

      {status.state === "error" ? (
        <div className="notice notice-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>无法导入</strong>
            <p>{status.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
