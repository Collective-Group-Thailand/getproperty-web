import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `MandateState` (G2, D-293) — an owner's listing mandate to an agency. */
export type MandateState = Schemas["MandateState"];

export const MANDATE_STATUS = defineStatuses<MandateState>("mandate", {
  invited: { tone: "info", icon: IconMail },
  accepted: { tone: "primary", icon: IconClock },
  active: { tone: "success", icon: IconCheckCircle },
  ended: { tone: "neutral", icon: IconHistory },
  revoked: { tone: "neutral", icon: IconXCircle },
});

/** `CoBrokeState` (G2, D-293) — a co-broke agreement between two agencies. */
export type CoBrokeState = Schemas["CoBrokeState"];

export const CO_BROKE_STATUS = defineStatuses<CoBrokeState>("coBroke", {
  proposed: { tone: "info", icon: IconMail },
  signed: { tone: "success", icon: IconCheckCircle },
  ended: { tone: "neutral", icon: IconHistory },
  cancelled: { tone: "neutral", icon: IconXCircle },
});
