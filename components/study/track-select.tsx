"use client";

import { useRouter } from "next/navigation";
import {
  courseTrackHref,
  type CourseTrackReference,
  type PracticeSurface,
} from "@/lib/course-structure";

export function TrackSelect({
  currentTrackId,
  sectionNumber,
  tracks,
  practiceSurface,
  compact = false,
}: {
  currentTrackId: string;
  sectionNumber: number;
  tracks: CourseTrackReference[];
  practiceSurface?: PracticeSurface;
  compact?: boolean;
}) {
  const router = useRouter();

  return (
    <label className={`track-select${compact ? " track-select-compact" : ""}`}>
      <small>SECTION {sectionNumber}</small>
      <select
        aria-label={`Section ${sectionNumber} 切换 Track`}
        value={currentTrackId}
        onChange={(event) => {
          const selectedTrack = tracks.find(
            (track) => track.id === event.target.value,
          );
          if (selectedTrack && selectedTrack.id !== currentTrackId) {
            router.push(courseTrackHref(selectedTrack, practiceSurface));
          }
        }}
      >
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            Track {track.number}
          </option>
        ))}
      </select>
    </label>
  );
}
