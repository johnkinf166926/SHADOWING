import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AudioLines, Disc3, FileText, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Progress } from "@/components/ui/progress";
import { buildCourseSections } from "@/lib/course-structure";
import { getCourseUnit } from "@/lib/server/course-content";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = await getCourseUnit(unitId);
  if (!unit) {
    notFound();
  }
  const sections = buildCourseSections(unit.lessons);
  const trackCount = sections.reduce(
    (total, section) => total + section.tracks.length,
    0,
  );

  return (
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          { label: `Unit ${unit.number}` },
        ]}
      />
      <header className="unit-detail-header">
        <span className="unit-detail-number">{unit.number}</span>
        <div>
          <p className="eyebrow">UNIT {unit.number}</p>
          <h1>{unit.title}</h1>
          <p className="unit-subtitle">{unit.subtitle}</p>
          <p className="muted">{unit.description}</p>
        </div>
        <div className="unit-detail-progress">
          <strong>{unit.progress}%</strong>
          <span>完成</span>
          <Progress value={unit.progress} label="Unit 完成度" />
        </div>
      </header>

      <section className="surface">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">SECTIONS & TRACKS</p>
            <h2>课程结构</h2>
          </div>
          <Badge tone="neutral">{trackCount} 个 Track</Badge>
        </div>
        <div className="course-section-list">
          {sections.map((section) => (
            <section
              className="course-section"
              id={`section-${section.number}`}
              key={section.number}
            >
              <header className="course-section-header">
                <div className="course-section-number">
                  <small>SECTION</small>
                  <strong>{section.number}</strong>
                </div>
                <div>
                  <h3>Section {section.number}</h3>
                  <p>{section.tracks.length} 组独立对话</p>
                </div>
                <Badge
                  tone={section.level === "ADVANCED" ? "accent" : "success"}
                >
                  {section.level === "ADVANCED" ? "上級" : "中級"}
                </Badge>
              </header>
              <div className="course-track-list">
                {section.tracks.map((track) => (
                  <article className="course-track-card" key={track.id}>
                    <div className="course-track-number">
                      <small>TRACK</small>
                      <strong>{track.number}</strong>
                    </div>
                    <div className="course-track-content">
                      <div className="course-track-title">
                        <h4>Track {track.number}</h4>
                        <span>{track.dialogue.lines.length} 句</span>
                      </div>
                      <div className="course-track-dialogue">
                        {track.dialogue.lines.slice(0, 4).map((line) => (
                          <p key={line.id}>
                            <b>{line.speaker}</b>
                            <span>{line.text}</span>
                          </p>
                        ))}
                        {track.dialogue.lines.length > 4 ? (
                          <small>
                            还有 {track.dialogue.lines.length - 4} 句…
                          </small>
                        ) : null}
                      </div>
                      <div className="lesson-meta">
                        <span>
                          <Disc3 size={14} />
                          原音 {track.sourceTrackNumber}
                        </span>
                        <span>
                          <FileText size={14} />
                          PDF {track.pdfPage ?? "—"}
                        </span>
                        <span>
                          <AudioLines size={14} />
                          已校准逐句时间
                        </span>
                      </div>
                    </div>
                    <div className="course-track-action">
                      <Link
                        className="button button-secondary"
                        href={`/tracks/${track.id}`}
                      >
                        <Play size={15} />
                        学习
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
