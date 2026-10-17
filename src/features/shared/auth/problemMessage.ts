import type { ActionProblem } from "@/lib/auth/actions";

/** Problem codes of the sign-in endpoints (contract) → keys under `auth.errors`. */
const CODE_KEYS: Record<string, string> = {
  "auth.otp_invalid": "otpInvalid",
  "auth.otp_expired": "otpExpired",
  "auth.otp_attempts_exceeded": "otpAttemptsExceeded",
  "auth.otp_rate_limited": "otpRateLimited",
  "http.too_many_requests": "otpRateLimited",
  "auth.invalid_credentials": "invalidCredentials",
  "auth.account_locked": "accountLocked",
  "auth.account_disabled": "accountDisabled",
  "auth.no_access": "noAccess",
  "auth.totp_invalid": "totpInvalid",
  "invitation.not_pending": "invitationNotPending",
  "invitation.not_found": "invitationNotPending",
  "tenant.not_in_scope": "tenantNotInScope",
  "service.unavailable": "unavailable",
  "provider.unavailable": "unavailable",
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The sentence to show for a failed sign-in step: our own copy for the codes we know (so it fits the
 * form), otherwise the API's localised `detail`, otherwise a generic line. Never the raw code.
 */
export function authProblemMessage(t: Translate, problem: ActionProblem): string {
  const key = CODE_KEYS[problem.code];
  if (key) return t(`errors.${key}`, { count: problem.attemptsRemaining ?? 0 });
  return problem.detail || t("errors.generic");
}
