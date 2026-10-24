import { safeReturnTo } from "@collective/web-kit";

/**
 * `?next=` targets are same-origin paths only (open-redirect guard, review H3). The guard itself lives in
 * `@collective/web-kit` (`safeReturnTo`, D-275) so every Collective product uses the same rules: parsed the way the
 * browser resolves it, control characters / whitespace / backslashes refused raw or percent-encoded, no
 * protocol-relative path after decoding, and the normalised `pathname + search + hash` comes back.
 */
export function safeNextPath(value: unknown): string | undefined {
  return safeReturnTo(value, "") || undefined;
}
