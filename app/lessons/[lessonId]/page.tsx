import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  AudioLines,
  Disc3,
  FileText,
  Heart,
  Headphones,
  Keyboard,
  MessagesSquare,
  Mic2,
  RotateCcw,
} from "lucide-react";
import { DialogueLineEditor } from "@/components/study/dialogue-line-editor";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getCourseLesson } from "@/lib/server/course-content";

const practiceModes = [
  {
    href: "practice",
    icon: Headphones,
    title: "听读练习",
    japanese: "リスニング",
    description: "逐句听原音、查看文本并调整播放速度。",
    tone: "mint",
  },
  {
    href: "shadowing",
    icon: Mic2,
    title: "跟读 Shadowing",
    japanese: "シャドーイング",
    description: "录下自己的声音，与原音逐句对比。",
    tone: "peach",
  },
  {
    href: "dictation",
    icon: Keyboard,
    title: "听写",
    japanese: "ディクテーション",
    description: "隐藏原文，完成字符级答案检查。",
    tone: "blue",
  },
  {
    href: "roleplay",
    icon: MessagesSquare,
    title: "应答练习",
    japanese: "受け答え",
    description: "扮演 A 或 B，在真实停顿中开口回答。",
    tone: "gold",
  },
] as const;

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = await getCourseLesson(lessonId);
  if (!lesson) {
    notFound();
  }

  return (
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          {
            label: `Unit ${lesson.unitNumber}`,
            href: `/units/${lesson.unitId}`,
          },
          { label: `Section ${lesson.sectionNumber}` },
        ]}
      />
      <header className="lesson-detail-header surface">
        <div className="lesson-detail-copy">
          <div className="lesson-detail-badges">
            <Badge tone={lesson.level === "ADVANCED" ? "accent" : "success"}>
              {lesson.level === "ADVANCED" ? "上級" : "中級"}
            </Badge>
            <Badge tone="neutral">Unit {lesson.unitNumber}</Badge>
            <Badge tone="neutral">Section {lesson.sectionNumber}</Badge>
          </div>
          <h1>{lesson.title}</h1>
          <p className="japanese-title">{lesson.subtitle}</p>
          <div className="lesson-meta large">
            <span>
              <Disc3 size={16} /> Disk {lesson.trackNumber}
            </span>
            <span>
              <FileText size={16} /> PDF 第 {lesson.pdfPage ?? "—"} 页
            </span>
            <span>
              <AudioLines size={16} /> {lesson.dialogues.length} 组对话
            </span>
          </div>
        </div>
        <button
          className="icon-button favorite-button"
          type="button"
          aria-label="切换课程收藏"
        >
          <Heart size={20} fill={lesson.favorite ? "currentColor" : "none"} />
        </button>
      </header>
      {!lesson.audioUrl ? (
        <div className="notice notice-neutral" role="status">
          <AudioLines size={17} />
          <p>
            当前未关联教材原音。听读、听写和跟读中的“播放”会使用浏览器日语朗读；
            上传对应音轨并设置时间范围后会自动切换为教材原音。
          </p>
        </div>
      ) : null}

      <section aria-labelledby="practice-modes-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">CHOOSE A MODE</p>
            <h2 id="practice-modes-title">选择练习方式</h2>
          </div>
          <span className="last-result">
            <RotateCcw size={14} />
            上次自评 4.2 / 5
          </span>
        </div>
        <div className="practice-mode-grid">
          {practiceModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                className="practice-mode-card"
                href={`/${mode.href}/${lesson.id}`}
                key={mode.href}
              >
                <span className={`practice-mode-icon ${mode.tone}`}>
                  <Icon size={22} />
                </span>
                <div>
                  <h3>{mode.title}</h3>
                  <span>{mode.japanese}</span>
                  <p>{mode.description}</p>
                </div>
                <ArrowRight size={18} className="practice-mode-arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="surface" aria-labelledby="dialogue-preview-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">DIALOGUE</p>
            <h2 id="dialogue-preview-title">对话预览</h2>
          </div>
          <Badge tone="neutral">
            {lesson.dialogues.reduce(
              (count, dialogue) => count + dialogue.lines.length,
              0,
            )}{" "}
            句
          </Badge>
        </div>
        <div className="dialogue-preview">
          {lesson.dialogues.flatMap((dialogue) =>
            dialogue.lines.map((line) => (
              <article
                className={`dialogue-row speaker-${line.speaker.toLowerCase()}`}
                key={line.id}
              >
                <Badge
                  tone={line.speaker === "A" ? "speakerA" : "speakerB"}
                  aria-label={`说话人 ${line.speaker}`}
                >
                  {line.speaker}
                </Badge>
                <div>
                  <DialogueLineEditor
                    dialogueId={dialogue.id}
                    lineId={line.id}
                    lineOrder={line.order}
                    initialSpeaker={line.speaker}
                    initialText={line.text}
                    initialReading={line.reading}
                    initialTranslation={line.translationZh}
                  />
                </div>
                <time>
                  {formatMs(line.startMs)} – {formatMs(line.endMs)}
                </time>
              </article>
            )),
          )}
        </div>
      </section>
    </div>
  );
}

function formatMs(milliseconds?: number) {
  if (milliseconds === undefined) {
    return "--:--";
  }
  const seconds = milliseconds / 1_000;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}
