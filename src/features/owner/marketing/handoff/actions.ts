"use server";

import { plausibleHandoffToken } from "@/features/shared/growth/handoff";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

export type DeclineState = { status: "idle" } | { status: "declined" } | { status: "closed" } | { status: "failed" };

/**
 * The buyer says "not now" to a getbuild rental invitation (G8, D-299): `POST /v1/public/handoffs/{token}/actions/decline`.
 * An invitation already used, declined or expired answers `handoff.invalid_state` → "closed".
 */
export async function declineHandoff(_prev: DeclineState, form: FormData): Promise<DeclineState> {
  const token = String(form.get("token") ?? "");
  if (!plausibleHandoffToken(token)) return { status: "failed" };
  try {
    const response = await fetch(
      `${serverEnv().API_INTERNAL_URL}/v1/public/handoffs/${encodeURIComponent(token)}/actions/decline`,
      { method: "POST", headers: { accept: "application/json", ...(await inboundEdgeHeaders()) }, cache: "no-store" },
    );
    if (response.ok) return { status: "declined" };
    return response.status === 409 ? { status: "closed" } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
