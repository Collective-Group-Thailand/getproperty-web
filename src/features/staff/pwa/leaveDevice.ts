"use client";

import { signOut } from "@/lib/auth/actions";
import { purgeStaffCaches } from "@/lib/pwa/caches";
import { unsubscribeFromPush } from "@/lib/pwa/push";
import { clearQueue, listQueue, ownership, setQueueIdentity } from "@/lib/pwa/queue";

import { clearDrafts, unsentDraftCount } from "../inspections/draft";
import { clearPin } from "../lock/pin";
import { PUSH_PROMPT_DISMISSED_KEY, PUSH_PROMPT_KEY } from "./PushPrompt";

/**
 * What a staff member leaves on a shared building phone when they sign out (review H2, M3, M4) — removed before the
 * session ends:
 * - the web-push subscription (deleted at the API while the session still exists, then unsubscribed in the
 *   browser), and the "ask for notifications" flags so the next person is asked for their own;
 * - the offline queue and the inspection drafts (unsent readings, photos, residents' signatures);
 * - every cache that could hold a rendered page or image (the static assets stay);
 * - the device PIN, which was this person's.
 * Each step is best effort: one failing never keeps the others from running or the sign-out from happening.
 */
export async function leaveStaffDevice(): Promise<void> {
  await Promise.allSettled([unsubscribeFromPush("staff"), clearQueue(), clearDrafts(), purgeStaffCaches()]);
  try {
    window.localStorage.removeItem(PUSH_PROMPT_KEY);
    window.localStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
  } catch {
    // storage unavailable
  }
  clearPin();
  setQueueIdentity(null);
}

/** What signing out would delete: this person's unsent queue entries and inspection drafts. */
export async function unsentOnDevice(): Promise<number> {
  const [entries, drafts] = await Promise.all([listQueue().catch(() => []), unsentDraftCount().catch(() => 0)]);
  return entries.filter((entry) => entry.state !== "sent" && ownership(entry) !== "someone-else").length + drafts;
}

/** Sign-out on the staff host: leave the device clean, end the session upstream, back to sign-in. */
export async function signOutStaff(loginHref: string): Promise<void> {
  await leaveStaffDevice();
  await signOut();
  window.location.assign(loginHref);
}
