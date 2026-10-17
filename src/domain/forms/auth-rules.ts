import { toE164 } from "@/ui/lib/phone";

/**
 * The sign-in field rules as plain functions — shared by the browser forms (react-hook-form `validate`,
 * no schema library shipped to the browser) and by the server's zod schemas (`./auth.ts`), so both
 * sides refuse the same input. Each returns `true` or the i18n key under `auth.errors`.
 */
export type Rule = (value: string) => true | string;

export const isPhone: Rule = (value) => toE164(value.trim()) !== null || "phoneInvalid";
export const isOtpCode: Rule = (value) => /^\d{6}$/.test(value) || "codeInvalid";
export const isOptionalOtpCode: Rule = (value) => value.trim() === "" || /^\d{6}$/.test(value.trim()) || "codeInvalid";
export const isEmail: Rule = (value) =>
  (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) || "emailInvalid";
export const isPassword: Rule = (value) => (value.length >= 1 && value.length <= 1024) || "passwordRequired";
