import { notFound } from "next/navigation";
import { DictationWorkspace } from "@/components/study/dictation-workspace";
import { TrackPager } from "@/components/study/track-pager";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getPracticeCourse } from "@/lib/server/course-content";

export default async function DictationPage({
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
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: "课程", href: "/units" },
          {
            label: track ? `Track ${track.number}` : lesson.title,
            href: track ? `/tracks/${track.id}` : `/lessons/${lesson.id}`,
          },
          { label: "听写" },
        ]}
      />
      <header className="page-heading">
        <div>
          <p className="eyebrow">DICTATION · ディクテーション</p>
          <h1>听写训练</h1>
          <p className="muted">
            先听后写，使用字符级差异发现助词、长音和汉字选择中的细节。
          </p>
        </div>
        <Badge tone="success">
          {track ? `Track ${track.number}` : lesson.title}
        </Badge>
      </header>
      {track ? (
        <TrackPager
          sectionNumber={lesson.sectionNumber}
          currentTrackNumber={track.number}
          previousTrack={previousTrack}
          nextTrack={nextTrack}
          practiceSurface="dictation"
        />
      ) : null}
      <DictationWorkspace lesson={lesson} />
    </div>
  );
}
