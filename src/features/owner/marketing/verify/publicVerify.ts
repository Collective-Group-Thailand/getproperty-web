import "server-only";

import { plausibleVerifyCode, verifyView, type VerifyView } from "@/features/owner/juristic/collections/verify";
import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

/**
 * A document issued through getproperty, checked by the code printed under its QR (D-306): the API answers only the
 * minimal facts (type, number, status, dates, issuer, unit, holder initials), and `verifyView` keeps exactly those.
 * Never cached — an expired certificate must read as expired at once; null when the code is unknown or refused (404)
 * or the API is down.
 */
export async function publicVerify(code: string): Promise<VerifyView | null> {
  if (!plausibleVerifyCode(code)) return null;
  try {
    const response = await fetch(
      `${serverEnv().API_INTERNAL_URL}/v1/public/documents/verify/${encodeURIComponent(code)}`,
      { headers: { accept: "application/json", ...(await inboundEdgeHeaders()) }, cache: "no-store" },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as Schemas["VerifiedDocumentDto"];
    return typeof body.number === "string" ? verifyView(body) : null;
  } catch {
    return null;
  }
}
