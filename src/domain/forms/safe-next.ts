/**
 * `?next=` targets are same-origin paths only (open-redirect guard, review H3).
 *
 * The value is parsed the way the browser will resolve it — `new URL(value, origin)` with WHATWG rules, which
 * strip TAB/LF/CR and treat `\` as `/` — and must stay on that origin. Before parsing, anything a browser would
 * silently rewrite is refused outright: ASCII control characters, whitespace and backslashes, raw or
 * percent-encoded in the path (`/%09/evil.example`, `/\evil`, `/%5Cevil`), and a path that starts with `//`
 * (protocol-relative) in raw or decoded form. What comes back is the normalised `pathname + search + hash`, never
 * the raw string.
 */
const PROBE_ORIGIN = "https://next.invalid";
const MAX_LENGTH = 2048;
const RAW_FORBIDDEN = /[\u0000-\u001F\u007F\s\\]/u;
const DECODED_FORBIDDEN = /[\u0000-\u001F\u007F\\]/u;

function decodeAll(value: string): string | undefined {
  // Decode until stable (bounded): `%2509` → `%09` → TAB.
  let current = value;
  for (let round = 0; round < 3; round += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return undefined;
    }
    if (next === current) return current;
    current = next;
  }
  return current;
}

export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (RAW_FORBIDDEN.test(value)) return undefined;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return undefined;
  }
  if (url.origin !== PROBE_ORIGIN) return undefined;

  // The path is what a later redirect or `location.assign` resolves again: no encoded control characters,
  // whitespace or backslashes there, and no protocol-relative start once decoded.
  const decodedPath = decodeAll(url.pathname);
  if (decodedPath === undefined || DECODED_FORBIDDEN.test(decodedPath) || /\s/u.test(decodedPath)) return undefined;
  if (decodedPath.startsWith("//") || url.pathname.startsWith("//")) return undefined;
  // The query may carry encoded spaces (`?q=a%20b`) but never control characters.
  const decodedSearch = decodeAll(url.search);
  if (decodedSearch === undefined || /[\u0000-\u001F\u007F]/u.test(decodedSearch)) return undefined;

  return `${url.pathname}${url.search}${url.hash}`;
}
