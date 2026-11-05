import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `ResolutionState` (J1.1b, D-304) — a meeting's resolution: drafted, adopted, or void. */
export type ResolutionState = Schemas["ResolutionState"];

export const RESOLUTION_STATUS = defineStatuses<ResolutionState>("resolution", {
  draft: { tone: "neutral", icon: IconEdit },
  adopted: { tone: "success", icon: IconCheckCircle },
  void: { tone: "neutral", icon: IconXCircle },
});

/** `BudgetState` (J1.1b, D-304) — a building's yearly budget: draft, approved by a resolution, superseded. */
export type BudgetState = Schemas["BudgetState"];

export const BUDGET_STATUS = defineStatuses<BudgetState>("budget", {
  draft: { tone: "neutral", icon: IconEdit },
  approved: { tone: "success", icon: IconCheckCircle },
  superseded: { tone: "neutral", icon: IconHistory },
});

/**
 * Whether a unit's register is complete (Σ current shares = 100 %, D-323) — the register's own flag `incomplete`, never
 * a sum done in the console. An incomplete unit's common-fee drafts are not issuable.
 */
export type RegisterCompleteness = "complete" | "incomplete";

export const REGISTER_STATUS = defineStatuses<RegisterCompleteness>("register", {
  complete: { tone: "success", icon: IconCheckCircle },
  incomplete: { tone: "warning", icon: IconWarning },
});
