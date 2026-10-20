import type { Schemas } from "@/lib/api/types";

/** Rate plan kinds of the contract (`RatePlanKind`), in the order the page groups them. */
export const PLAN_KINDS: Schemas["RatePlanKind"][] = ["power", "water", "common_fee", "fund", "rent", "service"];
