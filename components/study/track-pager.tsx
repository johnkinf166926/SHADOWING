import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CourseTrackReference } from "@/lib/course-structure";

type PracticeSurface = "practice" | "shadowing" | "dictation" | "roleplay";

interface TrackPagerProps {
  sectionNumber: number;
  currentTrackNumber: number;
  previousTrack?: CourseTrackReference;
  nextTrack?: CourseTrackReference;
  practiceSurface?: PracticeSurface;
}

export function TrackPager({
  sectionNumber,
  currentTrackNumber,
  previousTrack,
  nextTrack,
  practiceSurface,
}: TrackPagerProps) {
  return (
    <nav className="track-pager" aria-label="Track 导航">
      {previousTrack ? (
        <Link
          className="button button-secondary track-pager-button"
          href={trackHref(previousTrack, practiceSurface)}
          rel="prev"
        >
          <ChevronLeft size={17} />
          <span>
            <small>上一个 Track</small>
            Track {previousTrack.number}
          </span>
        </Link>
      ) : (
        <span
          className="button button-secondary track-pager-button disabled"
          aria-disabled="true"
        >
          <ChevronLeft size={17} />
          <span>
            <small>上一个 Track</small>
            已到开头
          </span>
        </span>
      )}

      <span className="track-pager-current">
        <small>SECTION {sectionNumber}</small>
        <strong>Track {currentTrackNumber}</strong>
      </span>

      {nextTrack ? (
        <Link
          className="button button-secondary track-pager-button next"
          href={trackHref(nextTrack, practiceSurface)}
          rel="next"
        >
          <span>
            <small>下一个 Track</small>
            Track {nextTrack.number}
          </span>
          <ChevronRight size={17} />
        </Link>
      ) : (
        <span
          className="button button-secondary track-pager-button next disabled"
          aria-disabled="true"
        >
          <span>
            <small>下一个 Track</small>
            已到结尾
          </span>
          <ChevronRight size={17} />
        </span>
      )}
    </nav>
  );
}

function trackHref(
  track: CourseTrackReference,
  practiceSurface?: PracticeSurface,
) {
  return practiceSurface
    ? `/${practiceSurface}/${track.lessonId}?dialogue=${track.id}`
    : `/tracks/${track.id}`;
}
