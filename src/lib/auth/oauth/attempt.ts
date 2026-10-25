import type { OAuthProvider } from "./providers";

/**
 * One sign-in attempt between the start step and the provider's callback, kept in a host-only cookie for ten
 * minutes: the `state` the callback must echo (CSRF), the nonce and PKCE verifier, and what to do afterwards.
 * `SameSite=None` because Apple answers with a cross-site `form_post` (a Lax cookie would not come back); the value
 * holds no secret the browser does not already have, and it is single use (cleared by the callback).
 */
export const ATTEMPT_COOKIE = "__Host-gp_oauth";
export const ATTEMPT_MAX_AGE = 600;

export type OAuthIntent = "signin" | "signup" | "link";

export function isOAuthIntent(value: unknown): value is OAuthIntent {
  return value === "signin" || value === "signup" || value === "link";
}

export interface OAuthAttempt {
  provider: OAuthProvider;
  intent: OAuthIntent;
  state: string;
  nonce: string;
  verifier: string;
  locale: string;
  /** Same-origin path to open afterwards (already checked by `safeNextPath`). */
  next?: string;
  /** Sign-up: the name typed on the form (the provider's name is the fallback). */
  displayName?: string;
}

export function encodeAttempt(attempt: OAuthAttempt): string {
  return Buffer.from(JSON.stringify(attempt)).toString("base64url");
}

export function decodeAttempt(value: string | undefined): OAuthAttempt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OAuthAttempt>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.locale !== "string" ||
      !isOAuthIntent(parsed.intent) ||
      (parsed.provider !== "google" && parsed.provider !== "apple" && parsed.provider !== "line")
    ) {
      return null;
    }
    return parsed as OAuthAttempt;
  } catch {
    return null;
  }
}

export const attemptCookieOptions = (maxAge: number) =>
  ({ httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge }) as const;

/** Constant-time comparison of the echoed state. */
export function sameState(expected: string, received: string | null | undefined): boolean {
  if (!received || received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}
