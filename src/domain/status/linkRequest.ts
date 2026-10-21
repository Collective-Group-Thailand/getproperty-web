import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `PartyLinkRequestState` — contract enum, ops.party_link_request (D-226): a resident login that signed in
 * with the SMS code of a party's phone waits for the Owner to confirm it is that person.
 */
export type PartyLinkRequestState = Schemas["PartyLinkRequestState"];

export const LINK_REQUEST_STATUS = defineStatuses<PartyLinkRequestState>("linkRequest", {
  pending: { tone: "warning", icon: IconClock },
  confirmed: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
});

export const LINK_REQUEST_VALUES = Object.keys(LINK_REQUEST_STATUS) as PartyLinkRequestState[];
