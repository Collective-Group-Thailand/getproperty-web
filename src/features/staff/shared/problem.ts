import { isApiError, NetworkError } from "@/lib/api/errors";

/** A failed staff request in one line: the API's own localised detail, or "no signal" / the code. */
export function problemText(error: unknown, offline: string): string {
  if (isApiError(error)) return error.detail || error.title || error.code;
  if (error instanceof NetworkError) return offline;
  return offline;
}

/** One Idempotency-Key per action, kept across retries of the same action (contract §3). */
export function newKey(): string {
  return crypto.randomUUID();
}
