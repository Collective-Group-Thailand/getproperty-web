import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `BankAccountState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type BankAccountState = Schemas["BankAccountState"];

export const BANK_ACCOUNT_STATUS = defineStatuses<BankAccountState>("bankAccount", {
  pending_otp: { tone: "warning", icon: IconClock },
  active: { tone: "success", icon: IconCheckCircle },
  replaced: { tone: "neutral", icon: IconHistory },
  removed: { tone: "neutral", icon: IconXCircle },
});

export const BANK_ACCOUNT_VALUES = Object.keys(BANK_ACCOUNT_STATUS) as BankAccountState[];
