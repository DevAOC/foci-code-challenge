// Due dates are ISO 8601 instants on the wire; they are only ever turned into
// a Date here and rendered in the viewer's zone, so no other module needs to
// think about timezones.

const LOCALE = "en-US";

/** "Sep 3, 11:00 AM" in the viewer's zone; the year is added only when it is not the current one. */
export function formatDueDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** A todo is overdue once its due instant has passed and it is still not completed. */
export function isOverdue(iso: string | null, isCompleted: boolean, now: Date = new Date()): boolean {
  if (iso === null || isCompleted) return false;
  return new Date(iso).getTime() < now.getTime();
}
