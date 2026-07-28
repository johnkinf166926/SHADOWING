"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpenText,
  Database,
  Download,
  FileAudio2,
  FileJson2,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ApiResponse } from "@/lib/api-response";
import { lessonFormSchema, unitFormSchema } from "@/lib/content-schema";
import { AudioUpload } from "./audio-upload";
import { ImportPanel } from "./import-panel";

type Tab = "structure" | "import" | "audio" | "settings";
type UnitForm = z.input<typeof unitFormSchema>;
type LessonForm = z.input<typeof lessonFormSchema>;

interface AdminUnit {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  lessonCount: number;
}

interface AdminLesson {
  id: string;
  unitId: string;
  sectionNumber: number;
  level: "INTERMEDIATE" | "ADVANCED";
  title: string;
  subtitle: string | null;
  trackNumber: string;
  pdfPage: number | null;
  status: string;
}

const tabs = [
  { id: "structure", label: "教材结构", icon: Layers3 },
  { id: "import", label: "导入 / 导出", icon: FileJson2 },
  { id: "audio", label: "音频管理", icon: FileAudio2 },
  { id: "settings", label: "本地设置", icon: Settings2 },
] as const;

export function AdminWorkspace() {
  const [tab, setTab] = useState<Tab>("structure");
  const [notice, setNotice] = useState<string>();
  const [units, setUnits] = useState<AdminUnit[]>([]);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [editingUnitId, setEditingUnitId] = useState<string>();
  const [editingLessonId, setEditingLessonId] = useState<string>();
  const unitForm = useForm<UnitForm>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: { number: 4, title: "", subtitle: "", description: "" },
  });
  const lessonForm = useForm<LessonForm>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      unitId: "",
      sectionNumber: 3,
      level: "INTERMEDIATE",
      title: "",
      subtitle: "",
      trackNumber: "",
      pdfPage: undefined,
    },
  });

  const refreshContent = useCallback(async () => {
    try {
      const [unitResponse, lessonResponse] = await Promise.all([
        fetch("/api/units"),
        fetch("/api/lessons"),
      ]);
      const [unitPayload, lessonPayload] = (await Promise.all([
        unitResponse.json(),
        lessonResponse.json(),
      ])) as [ApiResponse<AdminUnit[]>, ApiResponse<AdminLesson[]>];
      if (!unitPayload.ok) {
        throw new Error(unitPayload.error.message);
      }
      if (!lessonPayload.ok) {
        throw new Error(lessonPayload.error.message);
      }
      setUnits(unitPayload.data);
      setLessons(lessonPayload.data);
      const currentUnitId = lessonForm.getValues("unitId");
      if (
        unitPayload.data.length > 0 &&
        !unitPayload.data.some((unit) => unit.id === currentUnitId)
      ) {
        lessonForm.setValue("unitId", unitPayload.data[0].id);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "课程结构读取失败。");
    } finally {
      setLoadingContent(false);
    }
  }, [lessonForm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshContent();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshContent]);

  async function saveUnit(values: UnitForm) {
    setNotice(undefined);
    const response = await fetch(
      editingUnitId ? `/api/units/${editingUnitId}` : "/api/units",
      {
        method: editingUnitId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const result = (await response.json()) as ApiResponse<{ id: string }>;
    if (result.ok) {
      setNotice(result.message ?? "Unit 已保存。");
      setEditingUnitId(undefined);
      unitForm.reset({
        number: Number(values.number) + (editingUnitId ? 0 : 1),
        title: "",
        subtitle: "",
        description: "",
      });
      await refreshContent();
    } else {
      setNotice(result.error.message);
    }
  }

  async function saveLesson(values: LessonForm) {
    setNotice(undefined);
    const response = await fetch(
      editingLessonId ? `/api/lessons/${editingLessonId}` : "/api/lessons",
      {
        method: editingLessonId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          pdfPage: values.pdfPage || undefined,
        }),
      },
    );
    const result = (await response.json()) as ApiResponse<{ id: string }>;
    setNotice(
      result.ok ? (result.message ?? "课程已保存。") : result.error.message,
    );
    if (result.ok) {
      setEditingLessonId(undefined);
      lessonForm.reset({
        unitId: values.unitId,
        sectionNumber: Number(values.sectionNumber) + 1,
        level: values.level,
        title: "",
        subtitle: "",
        trackNumber: "",
        pdfPage: undefined,
      });
      await refreshContent();
    }
  }

  function editUnit(unit: AdminUnit) {
    setEditingUnitId(unit.id);
    unitForm.reset({
      number: unit.number,
      title: unit.title,
      subtitle: unit.subtitle ?? "",
      description: unit.description ?? "",
    });
  }

  function editLesson(lesson: AdminLesson) {
    setEditingLessonId(lesson.id);
    lessonForm.reset({
      unitId: lesson.unitId,
      sectionNumber: lesson.sectionNumber,
      level: lesson.level,
      title: lesson.title,
      subtitle: lesson.subtitle ?? "",
      trackNumber: lesson.trackNumber,
      pdfPage: lesson.pdfPage ?? undefined,
    });
  }

  async function deleteItem(kind: "unit" | "lesson", id: string) {
    const label = kind === "unit" ? "Unit" : "Section";
    if (!window.confirm(`确认删除这个 ${label}？此操作无法撤销。`)) {
      return;
    }
    const response = await fetch(
      kind === "unit" ? `/api/units/${id}` : `/api/lessons/${id}`,
      { method: "DELETE" },
    );
    const result = (await response.json()) as ApiResponse<{ id: string }>;
    setNotice(
      result.ok
        ? (result.message ?? `${label} 已删除。`)
        : result.error.message,
    );
    if (result.ok) {
      if (kind === "unit" && editingUnitId === id) {
        setEditingUnitId(undefined);
        unitForm.reset();
      }
      if (kind === "lesson" && editingLessonId === id) {
        setEditingLessonId(undefined);
        lessonForm.reset();
      }
      await refreshContent();
    }
  }

  return (
    <div className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="教材管理功能">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`admin-tab ${tab === item.id ? "admin-tab-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              key={item.id}
              onClick={() => setTab(item.id)}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>

      {notice ? (
        <div className="notice notice-neutral" role="status">
          <Database size={17} />
          <p>{notice}</p>
        </div>
      ) : null}

      {tab === "structure" ? (
        <div className="admin-two-columns">
          <section className="surface">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">CURRENT CONTENT</p>
                <h2>课程结构</h2>
              </div>
              <button
                className="button button-ghost compact"
                type="button"
                disabled={loadingContent}
                onClick={() => {
                  setLoadingContent(true);
                  void refreshContent();
                }}
              >
                <RefreshCw size={14} />
                刷新
              </button>
            </div>
            <div className="admin-tree">
              {loadingContent ? (
                <p className="muted">正在读取本地课程结构…</p>
              ) : null}
              {!loadingContent && units.length === 0 ? (
                <p className="muted">还没有 Unit，请先在右侧创建。</p>
              ) : null}
              {units.map((unit) => (
                <div className="admin-tree-unit" key={unit.id}>
                  <div className="admin-tree-unit-row">
                    <span className="unit-seal small">U{unit.number}</span>
                    <div>
                      <strong>{unit.title}</strong>
                      <small>{unit.lessonCount} 个 Section</small>
                    </div>
                    <div className="admin-tree-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="编辑 Unit"
                        aria-label={`编辑 Unit ${unit.number}`}
                        onClick={() => editUnit(unit)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="删除 Unit"
                        aria-label={`删除 Unit ${unit.number}`}
                        onClick={() => void deleteItem("unit", unit.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {lessons
                    .filter((lesson) => lesson.unitId === unit.id)
                    .map((lesson) => (
                      <div className="admin-tree-lesson" key={lesson.id}>
                        <BookOpenText size={15} />
                        <span>
                          Section {lesson.sectionNumber} · {lesson.title}
                        </span>
                        <small>{lesson.trackNumber}</small>
                        <div className="admin-tree-actions">
                          <button
                            className="icon-button"
                            type="button"
                            title="编辑 Section"
                            aria-label={`编辑 Section ${lesson.sectionNumber}`}
                            onClick={() => editLesson(lesson)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            title="删除 Section"
                            aria-label={`删除 Section ${lesson.sectionNumber}`}
                            onClick={() => void deleteItem("lesson", lesson.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </section>

          <div className="admin-form-stack">
            <form
              className="surface admin-form"
              onSubmit={unitForm.handleSubmit(saveUnit)}
            >
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">{editingUnitId ? "EDIT" : "CREATE"}</p>
                  <h2>{editingUnitId ? "编辑 Unit" : "新建 Unit"}</h2>
                </div>
                {editingUnitId ? <Pencil size={19} /> : <Plus size={19} />}
              </div>
              <div className="form-grid two">
                <label>
                  <span>Unit 编号</span>
                  <input
                    type="number"
                    min={1}
                    {...unitForm.register("number")}
                  />
                  <small>{unitForm.formState.errors.number?.message}</small>
                </label>
                <label>
                  <span>日文标题</span>
                  <input
                    placeholder="例：意見を伝える"
                    {...unitForm.register("title")}
                  />
                  <small>{unitForm.formState.errors.title?.message}</small>
                </label>
              </div>
              <label>
                <span>中文副标题</span>
                <input
                  placeholder="例：表达观点"
                  {...unitForm.register("subtitle")}
                />
              </label>
              <label>
                <span>说明</span>
                <textarea rows={3} {...unitForm.register("description")} />
              </label>
              <div className="form-actions">
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={unitForm.formState.isSubmitting}
                >
                  <Save size={16} />
                  {editingUnitId ? "更新 Unit" : "保存 Unit"}
                </button>
                {editingUnitId ? (
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => {
                      setEditingUnitId(undefined);
                      unitForm.reset();
                    }}
                  >
                    <X size={16} />
                    取消
                  </button>
                ) : null}
              </div>
            </form>

            <form
              className="surface admin-form"
              onSubmit={lessonForm.handleSubmit(saveLesson)}
            >
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">
                    {editingLessonId ? "EDIT" : "CREATE"}
                  </p>
                  <h2>{editingLessonId ? "编辑 Section" : "新建 Section"}</h2>
                </div>
                {editingLessonId ? <Pencil size={19} /> : <Plus size={19} />}
              </div>
              <div className="form-grid two">
                <label>
                  <span>所属 Unit</span>
                  <select {...lessonForm.register("unitId")}>
                    <option value="" disabled>
                      请选择 Unit
                    </option>
                    {units.map((unit) => (
                      <option value={unit.id} key={unit.id}>
                        Unit {unit.number} · {unit.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Section 编号</span>
                  <input
                    type="number"
                    min={1}
                    {...lessonForm.register("sectionNumber")}
                  />
                </label>
                <label>
                  <span>难度</span>
                  <select {...lessonForm.register("level")}>
                    <option value="INTERMEDIATE">中級</option>
                    <option value="ADVANCED">上級</option>
                  </select>
                </label>
                <label>
                  <span>音轨编号</span>
                  <input
                    placeholder="例：1-04"
                    {...lessonForm.register("trackNumber")}
                  />
                </label>
                <label>
                  <span>课程标题</span>
                  <input {...lessonForm.register("title")} />
                </label>
                <label>
                  <span>PDF 页码</span>
                  <input
                    type="number"
                    min={1}
                    {...lessonForm.register("pdfPage")}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={
                    lessonForm.formState.isSubmitting || units.length === 0
                  }
                >
                  <Save size={16} />
                  {editingLessonId ? "更新 Section" : "保存 Section"}
                </button>
                {editingLessonId ? (
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => {
                      setEditingLessonId(undefined);
                      lessonForm.reset();
                    }}
                  >
                    <X size={16} />
                    取消
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "import" ? (
        <div className="admin-two-columns">
          <section className="surface">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">IMPORT</p>
                <h2>JSON / CSV 导入</h2>
              </div>
              <FileJson2 size={20} />
            </div>
            <ImportPanel />
          </section>
          <section className="surface export-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">EXPORT</p>
                <h2>导出与格式</h2>
              </div>
              <Download size={20} />
            </div>
            <p className="muted">
              导出与导入使用相同结构，方便备份和在文本编辑器中批量维护。
            </p>
            <a
              className="button button-secondary"
              href="/api/content/export?unit=1"
              download
            >
              <Download size={16} />
              导出 Unit 1 JSON
            </a>
            <a
              className="text-link"
              href="/content-format.json"
              target="_blank"
              rel="noreferrer"
            >
              查看 JSON Schema
            </a>
          </section>
        </div>
      ) : null}

      {tab === "audio" ? (
        <section className="surface">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">AUDIO ASSETS</p>
              <h2>课程音频</h2>
            </div>
            <FileAudio2 size={20} />
          </div>
          <AudioUpload />
          <div className="audio-asset-table">
            <div className="audio-asset-row header">
              <span>文件</span>
              <span>关联课程</span>
              <span>区间</span>
              <span>状态</span>
            </div>
            <div className="audio-asset-row">
              <span>sample-dialogue.wav</span>
              <span>お願いの仕方</span>
              <span>4 句</span>
              <span className="validation-status valid">可用</span>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="surface settings-panel">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">LOCAL FIRST</p>
              <h2>本地数据设置</h2>
            </div>
            <Settings2 size={20} />
          </div>
          <div className="setting-row">
            <div>
              <strong>PDF 页面预览</strong>
              <p>仅在本机读取 private_content/book.pdf，不上传教材内容。</p>
            </div>
            <span className="local-badge">已保护</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>默认忽略听写标点</strong>
              <p>字符比较时保留汉字与假名的区别。</p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              aria-label="默认忽略听写标点"
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>离线缓存音频</strong>
              <p>默认关闭；在课程页面主动选择后才保存。</p>
            </div>
            <span className="local-badge neutral">按课程选择</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
