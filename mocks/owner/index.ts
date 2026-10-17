import type { HttpHandler } from "msw";

import { state } from "../state";
import { assetHandlers } from "./assets";
import { billingHandlers } from "./billing";
import { dashboardHandlers } from "./dashboard";
import { depositHandlers, residentAnswers } from "./deposits";
import { fileHandlers } from "./files";
import { leaseHandlers, residentSigns } from "./leases";
import { meteringHandlers } from "./metering";
import { partyHandlers } from "./parties";
import { paymentHandlers, providerPays } from "./payments";
import { initialOwnerWorld, type OwnerWorld } from "./world";

/** The owner surface's stateful handlers (F2); the contract-generated handlers answer what is not here. */
export const ownerHandlers: HttpHandler[] = [
  ...dashboardHandlers,
  ...fileHandlers,
  ...assetHandlers,
  ...partyHandlers,
  ...leaseHandlers,
  ...depositHandlers,
  ...billingHandlers,
  ...paymentHandlers,
  ...meteringHandlers,
];

/**
 * Parts of the owner world a spec file resets on its own, so parallel spec files do not reset each
 * other: `assets` (properties, buildings, floors, units, profiles, accounts), `leases` (parties, leases,
 * deposits, acknowledgements), `money` (cycles, invoices, charges, payments, slips, receipts, credits,
 * exports), `metering` (reviews, utility invoices), or everything.
 */
const PARTS: Record<string, (keyof OwnerWorld)[]> = {
  assets: ["properties", "buildings", "floors", "units", "profiles", "utilityAccounts", "imports"],
  leases: [
    "parties",
    "leases",
    "leaseEvents",
    "leaseInvitations",
    "deposits",
    "comparisons",
    "acknowledgements",
    "evaluations",
  ],
  money: ["cycles", "invoices", "charges", "payments", "slips", "receipts", "credits", "exports"],
  metering: ["reviews", "utilityInvoices", "ownerReadings"],
};

export function resetOwnerWorld(part: string | null): boolean {
  const fresh = initialOwnerWorld();
  if (!part) {
    state.owner = fresh;
    return true;
  }
  const keys = PARTS[part];
  if (!keys) return false;
  for (const key of keys) (state.owner as unknown as Record<string, unknown>)[key] = fresh[key];
  return true;
}

export { providerPays, residentAnswers, residentSigns };
