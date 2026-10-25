import type { ContractEnum } from "@/lib/api/types";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDoor } from "@/ui/icons/glyphs/door";

import { defineStatuses } from "./define";

/** `PortfolioUnitState` — a landlord's unit as the portfolio shows it (B7.1, D-251). */
export type PortfolioUnitState = ContractEnum<"PortfolioUnitState", "vacant" | "leased" | "notice_given">;

export const PORTFOLIO_UNIT_STATUS = defineStatuses<PortfolioUnitState>("portfolioUnit", {
  vacant: { tone: "neutral", icon: IconDoor },
  leased: { tone: "success", icon: IconCheckCircle },
  notice_given: { tone: "warning", icon: IconCalendar },
});
