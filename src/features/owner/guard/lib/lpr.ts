import type { PlateDetection } from "./api";

/**
 * The LPR card's two lists from the gate's recent reads (`view=recent`, the last hour):
 * - **claimable** — reads waiting for a guard (`pending`): claim pre-fills the form, dismiss clears it;
 * - **late** — reads the camera took during an outage and the cloud received late (`historical`, D-330 / CR-017):
 *   shown as history only, newest first and at most `limit` — they opened no barrier, made no entry and cannot be
 *   claimed (the API answers 409).
 * Every other state (claimed, dismissed, expired, matched, ignored) is not the guard's to act on here.
 */
export function lprView(
  detections: readonly PlateDetection[],
  limit = 3,
): { claimable: PlateDetection[]; late: PlateDetection[] } {
  const claimable = detections.filter((detection) => detection.state === "pending");
  const late = detections
    .filter((detection) => detection.state === "historical")
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
    .slice(0, limit);
  return { claimable, late };
}
