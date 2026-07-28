import { notFound } from "next/navigation";
import { AudioPracticePlayer } from "@/components/study/audio-practice-player";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getPracticeCourse } from "@/lib/server/course-content";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ dialogue?: string | string[] }>;
}) {
  const { lessonId } = await params;
  const dialogueValue = (await searchParams).dialogue;
  const dialogueId = Array.isArray(dialogueValue)
    ? dialogueValue[0]
    : dialogueValue;
  const course = await getPracticeCourse(lessonId, dialogueId);
  if (!course) {
    notFound();
  }
  const { lesson } = course;
  const track = "track" in course ? course.track : undefined;
  const previousTrack = "track" in course ? course.previousTrack : undefined;
  const nextTrack = "track" in course ? course.nextTrack : undefined;

  return (
    <div className="page-stack practice-page">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          {
            label: track ? `Track ${track.number}` : lesson.title,
            href: track ? `/tracks/${track.id}` : `/lessons/${lesson.id}`,
          },
          { label: "听读练习" },
        ]}
      />
      <header className="practice-page-header">
        <div>
          <p className="eyebrow">
            UNIT {lesson.unitNumber} · SECTION {lesson.sectionNumber}
            {track ? ` · TRACK ${track.number}` : ""} · DISK{" "}
            {lesson.trackNumber}
          </p>
          <h1>{track ? `Track ${track.number} · 听读练习` : lesson.title}</h1>
          <p>{lesson.subtitle}</p>
        </div>
        <Badge tone={lesson.level === "ADVANCED" ? "accent" : "success"}>
          {lesson.level === "ADVANCED" ? "上級" : "中級"}
        </Badge>
      </header>
      <AudioPracticePlayer
        lesson={lesson}
        clipPlayback={Boolean(track)}
        trackNavigation={
          track
            ? {
                currentTrackNumber: track.number,
                previousTrack,
                nextTrack,
              }
            : undefined
        }
      />
    </div>
  );
}
