import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  courseTrackHref,
  type CourseTrackReference,
  type PracticeSurface,
} from "@/lib/course-structure";
import { TrackSelect } from "./track-select";

interface TrackPagerProps {
  sectionNumber: number;
  currentTrackId: string;
  tracks: CourseTrackReference[];
  previousTrack?: CourseTrackReference;
  nextTrack?: CourseTrackReference;
  practiceSurface?: PracticeSurface;
}

export function TrackPager({
  sectionNumber,
  currentTrackId,
  tracks,
  previousTrack,
  nextTrack,
  practiceSurface,
}: TrackPagerProps) {
  return (
    <nav className="track-pager" aria-label="Track 导航">
      {previousTrack ? (
        <Link
          className="button button-secondary track-pager-button"
          href={courseTrackHref(previousTrack, practiceSurface)}
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

      <TrackSelect
        currentTrackId={currentTrackId}
        sectionNumber={sectionNumber}
        tracks={tracks}
        practiceSurface={practiceSurface}
      />

      {nextTrack ? (
        <Link
          className="button button-secondary track-pager-button next"
          href={courseTrackHref(nextTrack, practiceSurface)}
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
