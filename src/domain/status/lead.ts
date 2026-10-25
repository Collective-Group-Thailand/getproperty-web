import type { ContractEnum } from "@/lib/api/types";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconShow } from "@/ui/icons/glyphs/show";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `ListingLeadState` — a prospect's enquiry about a listing (B7.3, D-252). */
export type LeadState = ContractEnum<
  "ListingLeadState",
  "new" | "contacted" | "viewing_booked" | "viewed" | "applied" | "won" | "lost"
>;

export const LEAD_STATUS = defineStatuses<LeadState>("lead", {
  new: { tone: "info", icon: IconInbox },
  contacted: { tone: "neutral", icon: IconChat },
  viewing_booked: { tone: "primary", icon: IconCalendar },
  viewed: { tone: "primary", icon: IconShow },
  applied: { tone: "warning", icon: IconLease },
  won: { tone: "success", icon: IconCheckCircle },
  lost: { tone: "neutral", icon: IconArchive },
});

/** `ListingViewingState` — a viewing of a listing (B7.3, D-252). */
export type ViewingState = ContractEnum<
  "ListingViewingState",
  "requested" | "confirmed" | "declined" | "cancelled" | "completed" | "no_show"
>;

export const VIEWING_STATUS = defineStatuses<ViewingState>("listingViewing", {
  requested: { tone: "warning", icon: IconClock },
  confirmed: { tone: "success", icon: IconCalendarCheck },
  declined: { tone: "neutral", icon: IconXCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
  completed: { tone: "success", icon: IconCheckCircle },
  no_show: { tone: "danger", icon: IconXCircle },
});
