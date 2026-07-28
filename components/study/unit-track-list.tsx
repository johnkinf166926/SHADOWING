"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { UnitSectionSummary } from "@/lib/server/course-content";

export function UnitTrackList({
  sections,
}: {
  sections: UnitSectionSummary[];
}) {
  return (
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
                    <span>{track.lineCount} 句</span>
                  </div>
                  <div className="course-track-dialogue">
                    {track.firstLine ? (
                      <p>
                        <b>{track.firstLine.speaker}</b>
                        <span>{track.firstLine.text}</span>
                      </p>
                    ) : (
                      <small>暂无原文</small>
                    )}
                  </div>
                  <div className="lesson-meta">
                    <span>原音 {track.sourceTrackNumber}</span>
                    <span>PDF {track.pdfPage ?? "—"}</span>
                    <span>{track.lineCount} 句</span>
                  </div>
                </div>
                <div className="course-track-action">
                  <Link
                    className="button button-secondary"
                    href={`/tracks/${track.id}`}
                  >
                    学习
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
