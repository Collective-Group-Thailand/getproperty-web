/** A `datetime-local` value read as Bangkok wall time (operators and staff work in Asia/Bangkok), as an ISO instant. */
export function bangkokInstant(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
  return new Date(`${value.slice(0, 16)}:00+07:00`).toISOString();
}

/** An ISO instant as the `datetime-local` value of its Bangkok wall time (a form's default). */
export function bangkokLocal(instant: string | null | undefined): string {
  if (!instant) return "";
  const time = Date.parse(instant);
  if (Number.isNaN(time)) return "";
  return new Date(time + 7 * 3_600_000).toISOString().slice(0, 16);
}

/** Today's date in Bangkok (`YYYY-MM-DD`), offset by whole days — the earliest a form may choose. */
export function bangkokToday(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** The current instant in milliseconds — read once per render by server pages that compare with API times. */
export function currentTime(): number {
  return Date.now();
}
