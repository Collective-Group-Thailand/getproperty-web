import type { ContractEnum } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `RentCertificateState` — a rent payment certificate (B7.5, D-253). */
export type RentCertificateState = ContractEnum<"RentCertificateState", "requested" | "issued" | "declined">;

export const RENT_CERTIFICATE_STATUS = defineStatuses<RentCertificateState>("rentCertificate", {
  requested: { tone: "warning", icon: IconClock },
  issued: { tone: "success", icon: IconCheckCircle },
  declined: { tone: "neutral", icon: IconXCircle },
});
