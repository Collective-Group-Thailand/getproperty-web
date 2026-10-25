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
import { landlordDocumentHandlers } from "./landlord-documents";
import { initialLeads, leadHandlers } from "./leads";
import { initialListings, listingHandlers } from "./listings";
import { portfolioHandlers } from "./portfolio";
import { initialPortfolios } from "./portfolio-world";
import { releaseHandlers } from "./release";
import { settingsHandlers } from "./settings";
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
  ...releaseHandlers,
  ...paymentHandlers,
  ...meteringHandlers,
  ...settingsHandlers,
  ...portfolioHandlers,
  ...listingHandlers,
  ...leadHandlers,
  ...landlordDocumentHandlers,
];

/**
 * Parts of the owner world a spec file resets on its own, so parallel spec files do not reset each
 * other: `assets` (properties, buildings, floors, units, profiles, accounts), `leases` (parties, leases,
 * deposits, acknowledgements), `money` (cycles, invoices, charges, payments, slips, receipts, credits,
 * exports, e-Tax submissions), `metering` (reviews, utility invoices), `settings` (F2 2.6: settings, bank accounts, rate plans,
 * invitations, routes, consents, asset grants), or everything.
 */
const PARTS: Record<string, (keyof OwnerWorld)[]> = {
  assets: ["properties", "buildings", "floors", "units", "profiles", "utilityAccounts", "imports"],
  leases: [
    "parties",
    "leases",
    "leaseEvents",
    "scheduledTerminations",
    "leaseInvitations",
    "deposits",
    "comparisons",
    "acknowledgements",
    "evaluations",
  ],
  money: [
    "cycles",
    "invoices",
    "charges",
    "payments",
    "slips",
    "receipts",
    "credits",
    "exports",
    "readingRequests",
    "etax",
  ],
  // The api release fixes and B6.2: link requests (D-226) and TM30 notifications (D-216).
  release: [
    "linkRequests",
    "tm30",
    "tm30Files",
    "etax",
    "payments",
    "invoices",
    "receipts",
    "credits",
    "parties",
    "leases",
    "leaseEvents",
    "scheduledTerminations",
    "consents",
  ],
  metering: ["reviews", "utilityInvoices", "ownerReadings"],
  settings: [
    "settings",
    "propertySettings",
    "bankAccounts",
    "bankOtps",
    "ratePlans",
    "invitations",
    "routes",
    "consents",
    "assetGrants",
    "acknowledgements",
    "evaluations",
  ],
};

export function resetOwnerWorld(part: string | null): boolean {
  const fresh = initialOwnerWorld();
  if (!part || part === "portfolio") {
    // Landlord portfolios and the sign-up (B7.1) live beside the owner world.
    state.portfolio = initialPortfolios();
    state.landlordSignedUp = false;
    state.listingWorld = initialListings();
    state.leads = initialLeads();
    state.stampDuty = {};
    if (part) return true;
  }
  if (!part) {
    state.owner = fresh;
    state.stampDuty = {};
    return true;
  }
  const keys = PARTS[part];
  if (!keys) return false;
  for (const key of keys) (state.owner as unknown as Record<string, unknown>)[key] = fresh[key];
  return true;
}

export { providerPays, residentAnswers, residentSigns };
