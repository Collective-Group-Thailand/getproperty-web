import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `PlatformCreditNoteState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type PlatformCreditNoteState = Schemas["PlatformCreditNoteState"];

export const CREDIT_NOTE_STATUS = defineStatuses<PlatformCreditNoteState>("creditNote", {
  requested: { tone: "warning", icon: IconClock },
  issued: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
});

export const CREDIT_NOTE_VALUES = Object.keys(CREDIT_NOTE_STATUS) as PlatformCreditNoteState[];
