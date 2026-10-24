"use server";

import { toE164Thai } from "@collective/web-kit";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

/*
 * The public contact form (D-271 trust pages). CONTRACT-REQUEST (docs/contract-requests.md, 2026-10-25):
 * `POST /v1/public/contact-requests` — the API stores the lead, notifies the sales LINE group and rate-limits by
 * client address. Until it exists the MSW mock answers 202.
 */
const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // A Thai mobile or landline number in any common spelling, sent to the API as E.164 (@collective/web-kit).
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((value, ctx) => {
      const e164 = toE164Thai(value);
      if (e164 === null) {
        ctx.addIssue({ code: "custom", message: "phone" });
        return z.NEVER;
      }
      return e164;
    }),
  email: z.union([z.literal(""), z.email().max(200)]),
  role: z.enum(["dorm", "landlord", "renter", "partner"]),
  units: z.union([z.literal(""), z.string().regex(/^\d{1,5}$/)]),
  message: z.string().trim().min(1).max(2000),
  consent: z.literal("on"),
  locale: z.enum(["th", "en"]),
});

export type ContactState =
  { status: "idle" } | { status: "sent" } | { status: "invalid"; fields: string[] } | { status: "failed" };

export async function submitContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  }
  const { consent, units, email, ...rest } = parsed.data;
  void consent;
  try {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}/v1/public/contact-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(await inboundEdgeHeaders()) },
      body: JSON.stringify({
        ...rest,
        email: email || null,
        units: units || null,
        consentVersion: "privacy",
      }),
    });
    return response.ok ? { status: "sent" } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
