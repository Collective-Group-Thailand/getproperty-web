import type { Schemas } from "@/lib/api/types";

/** Every contract kind of the library (D-294), in the order the library lists them. */
export const CONTRACT_KINDS: Schemas["ContractKind"][] = [
  "lease_apartment_ocpb",
  "lease_condo_private",
  "lease_house",
  "lease_room",
  "reservation",
  "addendum",
  "brokerage_mandate",
  "co_broke",
  "notice_renewal",
  "notice_termination",
];

/** The kinds signed as a contract document (the lease kinds sign as a lease, the notices are letters). */
export const SIGNABLE_KINDS: Schemas["SignableContractKind"][] = [
  "reservation",
  "addendum",
  "brokerage_mandate",
  "co_broke",
];

export const LANGUAGES: Schemas["Language"][] = ["th", "en"];

export const isSignableKind = (kind: string): kind is Schemas["SignableContractKind"] =>
  (SIGNABLE_KINDS as string[]).includes(kind);
