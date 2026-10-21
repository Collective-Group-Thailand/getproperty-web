import { fingerprint } from "@/lib/api/submission";
import { sha256Hex } from "@/lib/api/sha256";
import type { Schemas } from "@/lib/api/types";

import type { InspectionDraft } from "./draft";

/**
 * The Idempotency-Key of an inspection completion (review M1): the key kept in the draft is reused only for the
 * very body it was first sent with — a retry after a lost answer is then a replay of the recorded completion. Changed
 * notes or signatures are a new submission and get a new key (a draft from before this rule, with a key but no
 * fingerprint, keeps its key).
 */
export async function completionKey(
  draft: Pick<InspectionDraft, "completeKey" | "completeFingerprint">,
  body: Schemas["InspectionCompleteDto"],
): Promise<{ key: string; fingerprint: string; changed: boolean }> {
  const digest = await sha256Hex(new Blob([fingerprint(body)]));
  if (draft.completeKey && (draft.completeFingerprint === undefined || draft.completeFingerprint === digest)) {
    return { key: draft.completeKey, fingerprint: digest, changed: draft.completeFingerprint === undefined };
  }
  return { key: crypto.randomUUID(), fingerprint: digest, changed: true };
}
