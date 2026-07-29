import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  AudioLines,
  Disc3,
  FileText,
  Headphones,
  Keyboard,
  MessagesSquare,
  Mic2,
} from "lucide-react";
import { DialogueLineEditor } from "@/components/study/dialogue-line-editor";
import { TrackPager } from "@/components/study/track-pager";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getCourseTrack } from "@/lib/server/course-content";

const practiceModes = [
  {
    href: "practice",
    icon: Headphones,
    title: "听读练习",
    japanese: "リスニング",
    description: "逐句播放这一组对话的教材原声。",
    tone: "mint",
  },
  {
    href: "shadowing",
    icon: Mic2,
    title: "跟读 Shadowing",
    japanese: "シャドーイング",
    description: "只练习当前 Track，并保存自己的录音。",
    tone: "peach",
  },
  {
    href: "dictation",
    icon: Keyboard,
    title: "听写",
    japanese: "ディクテーション",
    description: "使用当前 Track 的台词进行逐句听写。",
    tone: "blue",
  },
  {
    href: "roleplay",
    icon: MessagesSquare,
    title: "应答练习",
    japanese: "受け答え",
    description: "在当前 A/B 对话中选择角色并开口回答。",
    tone: "gold",
  },
] as const;

export default async function TrackPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const course = await getCourseTrack(trackId);
  if (!course) {
    notFound();
  }
  const { lesson, nextTrack, previousTrack, sectionTracks, track } = course;

  return (
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          {
            label: `Unit ${lesson.unitNumber}`,
            href: `/units/${lesson.unitId}`,
          },
          {
            label: `Section ${lesson.sectionNumber}`,
            href: `/units/${lesson.unitId}#section-${lesson.sectionNumber}`,
          },
          { label: `Track ${track.number}` },
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
          <h1>Track {track.number}</h1>
          <p className="japanese-title">{track.dialogue.lines[0]?.text}</p>
          <div className="lesson-meta large">
            <span>
              <Disc3 size={16} /> 原版音频 {lesson.trackNumber}
            </span>
            <span>
              <FileText size={16} /> PDF 第 {lesson.pdfPage ?? "—"} 页
            </span>
            <span>
              <AudioLines size={16} /> {track.dialogue.lines.length} 句
            </span>
          </div>
        </div>
      </header>

      <TrackPager
        sectionNumber={lesson.sectionNumber}
        currentTrackId={track.id}
        tracks={sectionTracks}
        previousTrack={previousTrack}
        nextTrack={nextTrack}
      />

      <section aria-labelledby="practice-modes-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">CHOOSE A MODE</p>
            <h2 id="practice-modes-title">学习 Track {track.number}</h2>
          </div>
        </div>
        <div className="practice-mode-grid">
          {practiceModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                className="practice-mode-card"
                href={`/${mode.href}/${lesson.id}?dialogue=${track.id}`}
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

      <section className="surface" aria-labelledby="track-dialogue-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">TRACK {track.number}</p>
            <h2 id="track-dialogue-title">对话原文</h2>
          </div>
          <Badge tone="neutral">{track.dialogue.lines.length} 句</Badge>
        </div>
        <div className="dialogue-preview">
          {track.dialogue.lines.map((line) => (
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
                  dialogueId={track.dialogue.id}
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
          ))}
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
