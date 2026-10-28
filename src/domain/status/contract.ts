import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `ContractDocumentState` (G3, D-294) — a signable contract (reservation, addendum, brokerage mandate, co-broke). */
export type ContractDocumentState = Schemas["ContractDocumentState"];

export const CONTRACT_DOCUMENT_STATUS = defineStatuses<ContractDocumentState>("contractDocument", {
  draft: { tone: "neutral", icon: IconEdit },
  pending_signature: { tone: "info", icon: IconSign },
  signed: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const CONTRACT_DOCUMENT_VALUES = Object.keys(CONTRACT_DOCUMENT_STATUS) as ContractDocumentState[];

/**
 * `LegalReviewState` (G3, D-294, O-025 / O-030) — every draft stays `pending_legal_verification` until counsel signs
 * a version off: amber, because nothing is presented as lawyer-approved.
 */
export type LegalReviewState = Schemas["LegalReviewState"];

export const LEGAL_REVIEW_STATUS = defineStatuses<LegalReviewState>("legalReview", {
  pending_legal_verification: { tone: "warning", icon: IconWarning },
  reviewed: { tone: "success", icon: IconShield },
});

/** `RenewalOfferState` (G3, D-294) — an owner's renewal offer the resident answers in LINE. */
export type RenewalOfferState = Schemas["RenewalOfferState"];

export const RENEWAL_OFFER_STATUS = defineStatuses<RenewalOfferState>("renewalOffer", {
  offered: { tone: "info", icon: IconMail },
  accepted: { tone: "success", icon: IconCheckCircle },
  declined: { tone: "neutral", icon: IconXCircle },
  expired: { tone: "neutral", icon: IconClock },
  withdrawn: { tone: "neutral", icon: IconUndo },
});

export const RENEWAL_OFFER_VALUES = Object.keys(RENEWAL_OFFER_STATUS) as RenewalOfferState[];
