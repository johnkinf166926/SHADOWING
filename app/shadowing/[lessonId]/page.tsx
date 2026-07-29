import { notFound } from "next/navigation";
import { ShadowingWorkspace } from "@/components/study/shadowing-workspace";
import { TrackPager } from "@/components/study/track-pager";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getPracticeCourse } from "@/lib/server/course-content";

export default async function ShadowingPage({
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
  const sectionTracks = "track" in course ? course.sectionTracks : [];

  return (
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          {
            label: track ? `Track ${track.number}` : lesson.title,
            href: track ? `/tracks/${track.id}` : `/lessons/${lesson.id}`,
          },
          { label: "跟读 Shadowing" },
        ]}
      />
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            UNIT {lesson.unitNumber} · SECTION {lesson.sectionNumber}
            {track ? ` · TRACK ${track.number}` : ""}
          </p>
          <h1>跟读 · Shadowing</h1>
          <p className="muted">
            每次专注一句：听原音、录下自己的声音，再对比时长与节奏。
            可切换全部台词、A 角色或 B 角色。
          </p>
        </div>
        <Badge tone="accent">Disk {lesson.trackNumber}</Badge>
      </header>
      {track ? (
        <TrackPager
          sectionNumber={lesson.sectionNumber}
          currentTrackId={track.id}
          tracks={sectionTracks}
          previousTrack={previousTrack}
          nextTrack={nextTrack}
          practiceSurface="shadowing"
        />
      ) : null}
      <ShadowingWorkspace lesson={lesson} />
    </div>
  );
}
