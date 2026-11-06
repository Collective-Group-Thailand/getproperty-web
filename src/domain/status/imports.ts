import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * The import wizard (pack J, JW3a; api J3.1, D-332). A job in progress is the office's own work (neutral / info); a
 * committed job waits for go-live (warning: the building issues nothing until then); live is success; a rollback or a
 * cancellation is history (neutral) — never red: nothing is wrong, the office decided.
 */

/** `ImportState` — draft → validated → reconciled → committed → live; rolled_back (from committed), cancelled. */
export const IMPORT_STATUS = defineStatuses<Schemas["ImportState"]>("importJob", {
  draft: { tone: "neutral", icon: IconEdit },
  validated: { tone: "info", icon: IconChecklist },
  reconciled: { tone: "info", icon: IconChecklist },
  committed: { tone: "warning", icon: IconClock },
  live: { tone: "success", icon: IconCheckCircle },
  rolled_back: { tone: "neutral", icon: IconUndo },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/**
 * `ReconcileStatus` — the badge of a reconcile block (J-DESIGN §3: the figures stay ink, the badge explains). A
 * difference is a task (warning "ต้องอธิบายส่วนต่าง"); no statement is information, not a fault.
 */
export const RECONCILE_STATUS = defineStatuses<Schemas["ReconcileStatus"]>("reconcile", {
  match: { tone: "success", icon: IconCheckCircle },
  mismatch: { tone: "warning", icon: IconAlert },
  no_statement: { tone: "info", icon: IconInfo },
});
