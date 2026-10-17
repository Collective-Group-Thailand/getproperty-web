import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `DsrState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type DsrState = Schemas["DsrState"];

export const DSR_STATUS = defineStatuses<DsrState>("dsr", {
  received: { tone: "warning", icon: IconInbox },
  verifying: { tone: "info", icon: IconShield },
  in_progress: { tone: "info", icon: IconPlay },
  fulfilled: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
  withdrawn: { tone: "neutral", icon: IconUndo },
});

export const DSR_VALUES = Object.keys(DSR_STATUS) as DsrState[];
