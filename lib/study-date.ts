export const studyTimeZone = "Asia/Tokyo";

export function studyDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: studyTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value] as const));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function calculateStudyStreak(
  studyDates: Iterable<string>,
  today: string,
) {
  const dates = new Set(studyDates);
  let cursor = dates.has(today) ? today : shiftDateKey(today, -1);
  let streak = 0;

  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
