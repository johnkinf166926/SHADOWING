import { notFound } from "next/navigation";
import { RoleplayWorkspace } from "@/components/study/roleplay-workspace";
import { TrackPager } from "@/components/study/track-pager";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getPracticeCourse } from "@/lib/server/course-content";

export default async function RoleplayPage({
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
          { label: "应答练习" },
        ]}
      />
      <header className="page-heading">
        <div>
          <p className="eyebrow">ROLE PLAY · 受け答え</p>
          <h1>A/B 应答训练</h1>
          <p className="muted">
            选择一个角色，在属于你的停顿中自然回答；完成后逐句回听。
          </p>
        </div>
        <Badge tone="accent">
          {track ? `Track ${track.number}` : lesson.title}
        </Badge>
      </header>
      {track ? (
        <TrackPager
          sectionNumber={lesson.sectionNumber}
          currentTrackId={track.id}
          tracks={sectionTracks}
          previousTrack={previousTrack}
          nextTrack={nextTrack}
          practiceSurface="roleplay"
        />
      ) : null}
      <RoleplayWorkspace lesson={lesson} />
    </div>
  );
}
