import { z } from "zod";

import { toE164 } from "@/ui/lib/phone";

/**
 * Sign-in form schemas (client-side validation; the API validates again and its field errors are
 * mapped back onto the form). Messages are i18n keys under `auth.errors`, resolved by the form.
 */

/** Thai mobile number as typed (`081 000 1234`), sent to the API as E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => toE164(value) !== null, { message: "phoneInvalid" })
  .transform((value) => toE164(value)!);

export const otpCodeSchema = z.string().regex(/^\d{6}$/, { message: "codeInvalid" });

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  code: otpCodeSchema,
  invitationCode: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => value || undefined),
});

export const passwordLoginSchema = z.object({
  email: z.email({ message: "emailInvalid" }).max(254),
  password: z.string().min(1, { message: "passwordRequired" }).max(1024),
  totpCode: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(otpCodeSchema.optional()),
});

export const totpEnrollSchema = z.object({ enrollmentToken: z.string().min(16).max(512) });
export const totpActivateSchema = totpEnrollSchema.extend({ code: otpCodeSchema });

export const tenantChoiceSchema = z.object({ tenantId: z.uuid() });

/** `?next=` targets are same-site paths only — never `//host` or a scheme (open-redirect guard). */
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (/[\r\n]/.test(value)) return undefined;
  return value;
}
