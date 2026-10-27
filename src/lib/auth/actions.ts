"use server";

import { cookies } from "next/headers";
import type { z } from "zod";

import {
  landlordSignUpSchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordLoginSchema,
  tenantChoiceSchema,
  totpActivateSchema,
  totpEnrollSchema,
} from "@/domain/forms/auth";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Problem, TokenPair } from "@/lib/api/types";
import { isLocale } from "@/i18n/routing";

import {
  afterOperatorSignIn,
  authApiClient,
  operatorMe,
  rememberLanguage,
  requestLanguage,
  type OperatorNext,
  type OperatorZone,
} from "./operator-session";
import { clearSession, readRefreshToken, writeSession, writeTenant } from "./session";

/**
 * Sign-in, tenant choice and sign-out as Server Actions (00-master-plan.md §4: Server Actions only for
 * auth and small forms). Tokens never leave the server: every success writes the httpOnly cookies and
 * answers with where to go next. Failures carry the API's problem (code, localised detail, request
 * id, `attemptsRemaining`, `enrollmentToken`) so the form can say exactly what to do.
 */

export type ActionProblem = Pick<Problem, "code" | "status" | "title" | "detail"> &
  Partial<Pick<Problem, "requestId" | "attemptsRemaining" | "enrollmentToken" | "errors">>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; problem: ActionProblem };

export type { OperatorNext } from "./operator-session";

const apiClient = authApiClient;

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    problem: {
      code: "validation.failed",
      status: 422,
      title: "validation.failed",
      detail: "",
      errors: error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code, message: issue.message })),
    },
  };
}

function failure(error: unknown): ActionResult<never> {
  if (isApiError(error)) {
    const { problem } = error;
    return {
      ok: false,
      problem: {
        code: error.code,
        status: error.status,
        title: error.title,
        detail: error.detail,
        requestId: error.requestId,
        attemptsRemaining: problem.attemptsRemaining,
        enrollmentToken: problem.enrollmentToken,
        errors: error.errors,
      },
    };
  }
  console.error("auth action failed", error);
  return {
    ok: false,
    problem: { code: "service.unavailable", status: 503, title: "service.unavailable", detail: "" },
  };
}

const language = requestLanguage;

export async function requestOperatorOtp(
  input: z.input<typeof otpRequestSchema>,
): Promise<ActionResult<{ challengeId: string; expiresAt: string; resendAvailableAt: string }>> {
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const lang = await language();
    const data = await unwrap(
      (await apiClient(lang)).POST("/v1/auth/operator/otp/request", {
        body: { phone: parsed.data.phone, language: lang },
      }),
    );
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyOperatorOtp(
  zone: OperatorZone,
  input: z.input<typeof otpVerifySchema>,
): Promise<ActionResult<OperatorNext>> {
  const parsed = otpVerifySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const pair = await unwrap(
      (await apiClient(await language())).POST("/v1/auth/operator/otp/verify", { body: parsed.data }),
    );
    return { ok: true, data: await afterOperatorSignIn(zone, pair) };
  } catch (error) {
    return failure(error);
  }
}

export async function operatorPasswordLogin(
  zone: OperatorZone,
  input: z.input<typeof passwordLoginSchema>,
): Promise<ActionResult<OperatorNext>> {
  const parsed = passwordLoginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const pair = await unwrap(
      (await apiClient(await language())).POST("/v1/auth/operator/login", { body: parsed.data }),
    );
    return { ok: true, data: await afterOperatorSignIn(zone, pair) };
  } catch (error) {
    return failure(error);
  }
}

export async function platformLogin(input: z.input<typeof passwordLoginSchema>): Promise<ActionResult<null>> {
  const parsed = passwordLoginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const pair = await unwrap(
      (await apiClient(await language())).POST("/v1/auth/platform/login", { body: parsed.data }),
    );
    await afterPlatformSignIn(pair);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

/**
 * First platform sign-in (D-164): the API answers `auth.totp_enrollment_required` with a one-time
 * token; this returns the new secret, its otpauth URI and a QR code of it rendered here on the
 * server (no QR library in the browser bundle). The secret is shown once.
 */
export async function platformEnrollTotp(
  input: z.input<typeof totpEnrollSchema>,
): Promise<ActionResult<{ secret: string; otpauthUri: string; qrSvg: string }>> {
  const parsed = totpEnrollSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const data = await unwrap(
      (await apiClient(await language())).POST("/v1/auth/platform/totp/enroll", { body: parsed.data }),
    );
    const { toString } = await import("qrcode");
    const qrSvg = await toString(data.otpauthUri, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
    return { ok: true, data: { secret: data.secret, otpauthUri: data.otpauthUri, qrSvg } };
  } catch (error) {
    return failure(error);
  }
}

export async function platformActivateTotp(input: z.input<typeof totpActivateSchema>): Promise<ActionResult<null>> {
  const parsed = totpActivateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const pair = await unwrap(
      (await apiClient(await language())).POST("/v1/auth/platform/totp/activate", { body: parsed.data }),
    );
    await afterPlatformSignIn(pair);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

async function afterPlatformSignIn(pair: TokenPair): Promise<void> {
  await writeSession(pair);
  try {
    const api = await apiClient(undefined, { authorization: `Bearer ${pair.accessToken}` });
    const me = await unwrap(api.GET("/v1/admin/me"));
    await rememberLanguage(me.user.language);
  } catch {
    // The language is a convenience; the session is already written.
  }
}

/**
 * Tenant switcher (contract §8): only a tenant the operator belongs to is accepted — checked against
 * `/me` without a tenant header — and stored in `__Host-gp_tenant`, sent upstream as `X-Tenant-Id`.
 */
export async function selectTenant(
  zone: OperatorZone,
  input: z.input<typeof tenantChoiceSchema>,
): Promise<ActionResult<null>> {
  const parsed = tenantChoiceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const token = (await cookies()).get("__Host-gp_at")?.value;
    if (!token) return { ok: false, problem: { code: "auth.unauthenticated", status: 401, title: "", detail: "" } };
    const me = await operatorMe(zone, token);
    const tenant = me.tenants.find((candidate) => candidate.id === parsed.data.tenantId);
    if (!tenant || tenant.status === "deactivated") {
      return { ok: false, problem: { code: "tenant.not_in_scope", status: 403, title: "", detail: "" } };
    }
    await writeTenant(tenant.id);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

/** Ends the sign-in everywhere it is used (the API revokes the refresh family, D-163) and clears the cookies. */
export async function signOut(): Promise<ActionResult<null>> {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    try {
      await (await apiClient()).POST("/v1/auth/logout", { body: { refreshToken } });
    } catch (error) {
      console.error("logout upstream failed", error);
    }
  }
  await clearSession();
  return { ok: true, data: null };
}

/** Who signs up: a landlord (B7.1) or an estate agency (G2, D-293). */
export type SignUpKind = "landlord" | "agency";

/** Landlord self sign-up, step 1 (B7.1, D-251): an SMS code to any phone — no account or invitation needed. */
export async function requestLandlordSignUpOtp(
  input: z.input<typeof otpRequestSchema>,
  kind: SignUpKind = "landlord",
): Promise<ActionResult<{ challengeId: string; expiresAt: string; resendAvailableAt: string }>> {
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const lang = await language();
    const body = { phone: parsed.data.phone, language: lang };
    const api = await apiClient(lang);
    const data = await unwrap(
      kind === "agency"
        ? api.POST("/v1/public/signup/agency/otp", { body })
        : api.POST("/v1/public/signup/landlord/otp", { body }),
    );
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Landlord self sign-up, step 2: the API creates the landlord tenant (free, D-250) and answers operator tokens —
 * written to the httpOnly cookies here with the new tenant as the current one. Signing up again with the same phone
 * answers the landlord tenant it already owns (`created: false`), so a double submit never makes two accounts.
 */
export async function signUpLandlord(
  input: z.input<typeof landlordSignUpSchema>,
  kind: SignUpKind = "landlord",
): Promise<ActionResult<{ created: boolean }>> {
  const parsed = landlordSignUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const lang = await language();
    const body = {
      provider: "phone_otp" as const,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
      displayName: parsed.data.displayName,
      language: isLocale(lang) ? lang : ("th" as const),
    };
    const api = await apiClient(lang);
    // An estate agency signs up the same way and gets a tenant of type `agency` (G2, D-293).
    const result = await unwrap(
      kind === "agency"
        ? api.POST("/v1/public/signup/agency", { body })
        : api.POST("/v1/public/signup/landlord", { body }),
    );
    await writeSession(result.tokens);
    await writeTenant(result.tenant.id);
    return { ok: true, data: { created: result.created } };
  } catch (error) {
    return failure(error);
  }
}
