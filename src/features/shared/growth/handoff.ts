import type { Schemas } from "@/lib/api/types";

/*
 * getbuild rental handoff (G8, D-299): what the public invitation page and the console's claim page both show of a
 * unit getbuild handed over. Pure — the facts come from the API (getbuild's port); nothing is guessed.
 */

export type HandoffFacts = Schemas["HandoffFactsDto"];

/** Values a token may have: the API issues 32 url-safe characters; anything else is "unknown" without a request. */
export function plausibleHandoffToken(token: string | undefined): token is string {
  return !!token && /^[A-Za-z0-9_-]{16,128}$/.test(token);
}

/** The place in one line (project · district · province), only what getbuild told. */
export function handoffPlace(facts: HandoffFacts): string {
  return [facts.projectName, facts.district, facts.province].filter(Boolean).join(" · ");
}

/** Whether getbuild told enough of the address for the claim (else the API asks for it — `validation.failed`). */
export function handoffNeedsAddress(facts: HandoffFacts): boolean {
  return !facts.province || !facts.district;
}

/**
 * A headline suggestion the owner may edit before claiming (the API also titles the draft from the facts when no
 * title is sent). Labels come from the caller's messages: `kind` names the unit kind, `bedrooms` the count phrase.
 */
export function suggestedHandoffTitle(
  facts: HandoffFacts,
  labels: { kind: string; bedrooms: (count: number) => string; area: (sqm: string) => string },
): string {
  const parts = [
    labels.kind,
    facts.bedrooms !== null ? labels.bedrooms(facts.bedrooms) : null,
    facts.areaSqm ? labels.area(facts.areaSqm.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")) : null,
    facts.projectName,
  ].filter((part): part is string => !!part);
  return parts.join(" ").slice(0, 120);
}
