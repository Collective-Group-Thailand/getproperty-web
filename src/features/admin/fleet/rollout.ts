import type { Schemas } from "@/lib/api/types";

const TERMINAL: Schemas["OtaDeviceStatus"][] = ["applied", "failed", "rolled_back"];

/** A rollout's progress from the API's counts: gateways in a terminal state, applied and failed. */
export function rolloutProgress(rollout: Pick<Schemas["OtaRolloutDto"], "counts" | "devices">) {
  const counts = rollout.counts as Record<string, number>;
  const total = rollout.devices.length;
  const done = TERMINAL.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  return { total, done, applied: counts.applied ?? 0, failed: (counts.failed ?? 0) + (counts.rolled_back ?? 0) };
}
