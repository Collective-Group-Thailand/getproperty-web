import { z } from "zod";

import { toE164 } from "@/ui/lib/phone";

import { isDisplayName, isEmail, isOptionalOtpCode, isOtpCode, isPassword, isPhone, type Rule } from "./auth-rules";

/**
 * Sign-in input schemas of the Server Actions (`src/lib/auth/actions.ts`). The rules are the ones the
 * browser forms apply (`./auth-rules.ts`), so a request that passes the form passes here; the API
 * validates again. Server-only: zod is not shipped to the browser for the sign-in pages.
 */
const rule = (check: Rule) => (value: string, ctx: z.RefinementCtx) => {
  const result = check(value);
  if (result !== true) ctx.addIssue({ code: "custom", message: result });
};

export const phoneSchema = z
  .string()
  .superRefine(rule(isPhone))
  .transform((value) => toE164(value.trim())!);

export const otpCodeSchema = z.string().superRefine(rule(isOtpCode));

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  code: otpCodeSchema,
  invitationCode: optional(64),
});

export const passwordLoginSchema = z.object({
  email: z
    .string()
    .superRefine(rule(isEmail))
    .transform((value) => value.trim()),
  password: z.string().superRefine(rule(isPassword)),
  totpCode: z
    .string()
    .superRefine(rule(isOptionalOtpCode))
    .optional()
    .transform((value) => value?.trim() || undefined),
});

export const totpEnrollSchema = z.object({ enrollmentToken: z.string().min(16).max(512) });
export const totpActivateSchema = totpEnrollSchema.extend({ code: otpCodeSchema });

export const tenantChoiceSchema = z.object({ tenantId: z.uuid() });

export { safeNextPath } from "./safe-next";

/** Landlord self sign-up by phone (B7.1, D-251): the SMS code of `signup/landlord/otp` and the name. */
export const landlordSignUpSchema = z.object({
  challengeId: z.uuid(),
  code: otpCodeSchema,
  displayName: z
    .string()
    .superRefine(rule(isDisplayName))
    .transform((value) => value.trim()),
});
