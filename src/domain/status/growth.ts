import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconDoor } from "@/ui/icons/glyphs/door";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `MediaServiceState` (G5, D-297) — a verified photo / 360° order: waiting for its invoice, paid and waiting for the
 * partner's visit, visit booked, files delivered, cancelled.
 */
export type MediaServiceState = Schemas["MediaServiceState"];

export const MEDIA_SERVICE_STATUS = defineStatuses<MediaServiceState>("mediaService", {
  pending_payment: { tone: "warning", icon: IconClock },
  requested: { tone: "info", icon: IconSyncPending },
  scheduled: { tone: "info", icon: IconCalendarCheck },
  delivered: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const MEDIA_SERVICE_VALUES = Object.keys(MEDIA_SERVICE_STATUS) as MediaServiceState[];

/**
 * `FeeAccrualState` (G5, D-293 / D-297) — a success / co-broke fee: waiting for the monthly invoice, on an invoice,
 * disputed (credit note waiting for the second person), credited.
 */
export type FeeAccrualState = Schemas["FeeAccrualState"];

export const FEE_ACCRUAL_STATUS = defineStatuses<FeeAccrualState>("feeAccrual", {
  uninvoiced: { tone: "neutral", icon: IconClock },
  invoiced: { tone: "info", icon: IconReceipt },
  disputed: { tone: "warning", icon: IconWarning },
  credited: { tone: "success", icon: IconUndo },
});

export const FEE_ACCRUAL_VALUES = Object.keys(FEE_ACCRUAL_STATUS) as FeeAccrualState[];

/** `SocialChannelState` (G4, D-288) — the connected Facebook Page: posting, refused by Facebook, disconnected. */
export type SocialChannelState = Schemas["SocialChannelState"];

export const SOCIAL_CHANNEL_STATUS = defineStatuses<SocialChannelState>("socialChannel", {
  verified: { tone: "success", icon: IconCheckCircle },
  failing: { tone: "danger", icon: IconAlert },
  revoked: { tone: "neutral", icon: IconXCircle },
});

/** `SocialPostState` (G4, D-288) — a listing's post on the Page: waiting for the worker, on the Page, failed, removed. */
export type SocialPostState = Schemas["SocialPostState"];

export const SOCIAL_POST_STATUS = defineStatuses<SocialPostState>("socialPost", {
  queued: { tone: "info", icon: IconSyncPending },
  posted: { tone: "success", icon: IconCheckCircle },
  failed: { tone: "danger", icon: IconAlert },
  deleted: { tone: "neutral", icon: IconDelete },
});

/**
 * `SponsoredCampaignState` (G6, D-300) — a sponsored LINE broadcast: drafted, booked to start, being sent in batches,
 * finished (billed per delivered recipient), cancelled by the buyer (never billed), stopped by the platform team.
 */
export type SponsoredCampaignState = Schemas["SponsoredCampaignState"];

export const SPONSORED_CAMPAIGN_STATUS = defineStatuses<SponsoredCampaignState>("sponsoredCampaign", {
  draft: { tone: "neutral", icon: IconEdit },
  scheduled: { tone: "info", icon: IconCalendarCheck },
  sending: { tone: "info", icon: IconSyncPending },
  sent: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
  rejected: { tone: "danger", icon: IconAlert },
});

export const SPONSORED_CAMPAIGN_VALUES = Object.keys(SPONSORED_CAMPAIGN_STATUS) as SponsoredCampaignState[];

/**
 * `ViewingAccessState` (G7, D-295) — the door-code window of a self viewing: codes issued (not used yet), the visitor
 * is inside, they left, the window ended unused after an entry, nobody came, closed early (cancelled / ended by you).
 */
export type ViewingAccessState = Schemas["ViewingAccessState"];

export const VIEWING_ACCESS_STATUS = defineStatuses<ViewingAccessState>("viewingAccess", {
  issued: { tone: "info", icon: IconKey },
  entered: { tone: "warning", icon: IconDoor },
  exited: { tone: "success", icon: IconCheckCircle },
  expired: { tone: "neutral", icon: IconClock },
  no_show: { tone: "neutral", icon: IconXCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/**
 * `RentalHandoffState` (G8, D-299) — a unit handed over from getbuild: invitation waiting, claimed (listing draft),
 * listing published, declined by the buyer, invitation expired.
 */
export type RentalHandoffState = Schemas["RentalHandoffState"];

export const RENTAL_HANDOFF_STATUS = defineStatuses<RentalHandoffState>("rentalHandoff", {
  invited: { tone: "info", icon: IconSyncPending },
  accepted: { tone: "primary", icon: IconEdit },
  listed: { tone: "success", icon: IconMegaphone },
  declined: { tone: "neutral", icon: IconXCircle },
  expired: { tone: "neutral", icon: IconClock },
});

export const RENTAL_HANDOFF_VALUES = Object.keys(RENTAL_HANDOFF_STATUS) as RentalHandoffState[];

/** `EmployerAgreementState` (G8, D-299) — an employer paying for its workers' rooms: in force or ended. */
export type EmployerAgreementState = Schemas["EmployerAgreementState"];

export const EMPLOYER_AGREEMENT_STATUS = defineStatuses<EmployerAgreementState>("employerAgreement", {
  active: { tone: "success", icon: IconCheckCircle },
  ended: { tone: "neutral", icon: IconXCircle },
});

/**
 * `BuildingReviewState` (G9, D-301) — a verified tenant's review: waiting for the getproperty moderators, public,
 * rejected by them, hidden by them for abuse, withdrawn by its author.
 */
export type BuildingReviewState = Schemas["BuildingReviewState"];

export const BUILDING_REVIEW_STATUS = defineStatuses<BuildingReviewState>("buildingReview", {
  pending_moderation: { tone: "info", icon: IconClock },
  published: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "danger", icon: IconXCircle },
  hidden: { tone: "warning", icon: IconHide },
  withdrawn: { tone: "neutral", icon: IconUndo },
});

export const BUILDING_REVIEW_VALUES = Object.keys(BUILDING_REVIEW_STATUS) as BuildingReviewState[];
