import { http, type HttpHandler } from "msw";

import { MOCK_OTP_CODE, MOCK_TOTP_CODE, OPERATORS, PLATFORM_USERS, TENANTS } from "../fixtures";
import { state } from "../state";
import { issueTokens, json, problem } from "./support";

/** Stateful `/v1/auth/*` (contract §4): OTP challenges, password + TOTP, enrolment, rotation, logout. */

const MAX_ATTEMPTS = 5;
/** getproperty-api's default `REFRESH_REUSE_GRACE_SECONDS` (D-229). */
const REFRESH_REUSE_GRACE_MS = 30_000;

function subject(audience: "operator" | "platform", key: string) {
  if (audience === "operator") {
    const persona = OPERATORS.find((p) => p.key === key)!;
    const single = persona.memberships.length === 1 ? persona.memberships[0] : undefined;
    return {
      id: persona.user.id,
      type: "user" as const,
      audience,
      roles: single ? [single.role] : [],
      permissions: [],
      scopes: persona.memberships.map((m) => `tenant:${TENANTS[m.tenant].profile.id}`),
    };
  }
  const persona = PLATFORM_USERS.find((p) => p.key === key)!;
  return {
    id: persona.user.id,
    type: "user" as const,
    audience,
    roles: persona.roles,
    permissions: [],
    scopes: ["platform"],
  };
}

function signedIn(audience: "operator" | "platform", key: string) {
  return json({ ...issueTokens(audience, key), subject: subject(audience, key) });
}

export const authHandlers: HttpHandler[] = [
  http.post("*/v1/auth/operator/otp/request", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { phone?: string };
    if (!body.phone || !/^\+?\d{9,12}$/.test(body.phone.replace(/\s/g, ""))) {
      return problem("auth.operatorOtp.request", "validation.failed");
    }
    const challengeId = crypto.randomUUID();
    const now = Date.now();
    // Same answer for unknown phones (no account enumeration, D-164).
    state.challenges.set(challengeId, { phone: body.phone, attempts: 0, expiresAt: now + 5 * 60_000 });
    return json({
      challengeId,
      expiresAt: new Date(now + 5 * 60_000).toISOString(),
      resendAvailableAt: new Date(now + 60_000).toISOString(),
    });
  }),

  http.post("*/v1/auth/operator/otp/verify", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { challengeId?: string; code?: string };
    const challenge = body.challengeId ? state.challenges.get(body.challengeId) : undefined;
    if (!challenge || challenge.expiresAt < Date.now()) return problem("auth.operatorOtp.verify", "auth.otp_expired");
    if (body.code !== MOCK_OTP_CODE) {
      challenge.attempts += 1;
      const remaining = Math.max(0, MAX_ATTEMPTS - challenge.attempts);
      if (remaining === 0) state.challenges.delete(body.challengeId!);
      return problem("auth.operatorOtp.verify", "auth.otp_invalid", { attemptsRemaining: remaining });
    }
    state.challenges.delete(body.challengeId!);
    const persona = OPERATORS.find((p) => p.user.phone === challenge.phone);
    if (!persona) return problem("auth.operatorOtp.verify", "auth.no_access");
    return signedIn("operator", persona.key);
  }),

  http.post("*/v1/auth/operator/login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; totpCode?: string };
    const persona = OPERATORS.find((p) => p.user.email === body.email && p.password);
    if (!persona || persona.password !== body.password)
      return problem("auth.operatorSessions.login", "auth.invalid_credentials");
    if (persona.totp) {
      if (!body.totpCode) return problem("auth.operatorSessions.login", "auth.totp_required");
      if (body.totpCode !== MOCK_TOTP_CODE) return problem("auth.operatorSessions.login", "auth.totp_invalid");
    }
    return signedIn("operator", persona.key);
  }),

  http.post("*/v1/auth/platform/login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; totpCode?: string };
    const persona = PLATFORM_USERS.find((p) => p.user.email === body.email);
    if (!persona || persona.password !== body.password)
      return problem("auth.platformSessions.login", "auth.invalid_credentials");
    if (!state.enrolled.has(persona.key)) {
      const enrollmentToken = `mock-enrol-${crypto.randomUUID()}`;
      state.enrolment.set(enrollmentToken, { userKey: persona.key, activated: false });
      return problem("auth.platformSessions.login", "auth.totp_enrollment_required", { enrollmentToken });
    }
    if (!body.totpCode) return problem("auth.platformSessions.login", "auth.totp_required");
    if (body.totpCode !== MOCK_TOTP_CODE) return problem("auth.platformSessions.login", "auth.totp_invalid");
    return signedIn("platform", persona.key);
  }),

  http.post("*/v1/auth/platform/totp/enroll", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { enrollmentToken?: string };
    const enrolment = body.enrollmentToken ? state.enrolment.get(body.enrollmentToken) : undefined;
    if (!enrolment || enrolment.activated) return problem("auth.platformTotp.enroll", "auth.unauthenticated");
    const persona = PLATFORM_USERS.find((p) => p.key === enrolment.userKey)!;
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    return json({
      secret,
      otpauthUri: `otpauth://totp/getproperty:${encodeURIComponent(persona.user.email ?? "")}?secret=${secret}&issuer=getproperty&algorithm=SHA1&digits=6&period=30`,
    });
  }),

  http.post("*/v1/auth/platform/totp/activate", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { enrollmentToken?: string; code?: string };
    const enrolment = body.enrollmentToken ? state.enrolment.get(body.enrollmentToken) : undefined;
    if (!enrolment || enrolment.activated) return problem("auth.platformTotp.activate", "auth.unauthenticated");
    if (body.code !== MOCK_TOTP_CODE) return problem("auth.platformTotp.activate", "auth.totp_invalid");
    enrolment.activated = true;
    state.enrolled.add(enrolment.userKey);
    return signedIn("platform", enrolment.userKey);
  }),

  http.post("*/v1/auth/refresh", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };
    const grant = body.refreshToken ? state.refresh.get(body.refreshToken) : undefined;
    if (!grant || grant.revoked) return problem("auth.sessions.refresh", "auth.refresh_invalid");
    const successor = grant.successor && state.refresh.get(grant.successor.refreshToken);
    if (
      grant.used &&
      grant.successor &&
      successor &&
      !successor.used &&
      !successor.revoked &&
      Date.now() - grant.successor.at <= REFRESH_REUSE_GRACE_MS
    ) {
      // D-229 rotation grace: the previous token again, within the window and before its successor was used, answers
      // the same successor refresh token with a fresh access token (a page load whose requests raced the rotation).
      const fresh = issueTokens(grant.audience, grant.userKey, grant.family);
      state.refresh.delete(fresh.refreshToken);
      return json({
        ...fresh,
        refreshToken: grant.successor.refreshToken,
        subject: subject(grant.audience, grant.userKey),
      });
    }
    if (grant.used) {
      // Reuse of a rotated token ends the whole sign-in (D-163).
      for (const other of state.refresh.values()) if (other.family === grant.family) other.revoked = true;
      return problem("auth.sessions.refresh", "auth.refresh_reused");
    }
    grant.used = true;
    const pair = issueTokens(grant.audience, grant.userKey, grant.family);
    grant.successor = { refreshToken: pair.refreshToken, at: Date.now() };
    return json({ ...pair, subject: subject(grant.audience, grant.userKey) });
  }),

  http.post("*/v1/auth/logout", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };
    const grant = body.refreshToken ? state.refresh.get(body.refreshToken) : undefined;
    if (grant) {
      for (const other of state.refresh.values()) if (other.family === grant.family) other.revoked = true;
      for (const [token, access] of state.access) {
        if (access.userKey === grant.userKey && access.audience === grant.audience) state.access.delete(token);
      }
    }
    return new Response(null, { status: 204 });
  }),
];
