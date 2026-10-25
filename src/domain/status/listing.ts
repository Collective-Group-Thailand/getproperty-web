import type { ContractEnum } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { IconArchive } from "@/ui/icons/glyphs/archive";

import { defineStatuses } from "./define";

/** `ListingState` — a rental listing (D-252). */
export type ListingState = ContractEnum<
  "ListingState",
  "draft" | "pending_review" | "published" | "paused" | "closed" | "rejected"
>;

export const LISTING_STATUS = defineStatuses<ListingState>("listing", {
  draft: { tone: "neutral", icon: IconEdit },
  pending_review: { tone: "info", icon: IconClock },
  published: { tone: "success", icon: IconCheckCircle },
  paused: { tone: "warning", icon: IconHide },
  closed: { tone: "neutral", icon: IconArchive },
  rejected: { tone: "danger", icon: IconXCircle },
});

/** `ListingVerificationState` — owner verification of a unit (D-252). */
export type ListingVerificationState = ContractEnum<"ListingVerificationState", "pending" | "approved" | "rejected">;

export const LISTING_VERIFICATION_STATUS = defineStatuses<ListingVerificationState>("listingVerification", {
  pending: { tone: "info", icon: IconClock },
  approved: { tone: "success", icon: IconShield },
  rejected: { tone: "danger", icon: IconXCircle },
});
