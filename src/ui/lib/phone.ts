/**
 * `0812345678` → `+66812345678`; anything that is not a 9–10 digit Thai number comes back null.
 * Framework-free (no "use client") so form schemas validated in Server Actions can use it too.
 */
export function toE164(national: string): string | null {
  const digits = national.replace(/\D/g, "");
  if (/^0\d{8,9}$/.test(digits)) return `+66${digits.slice(1)}`;
  if (/^66\d{8,9}$/.test(digits)) return `+${digits}`;
  return null;
}
