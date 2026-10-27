import type { HttpHandler } from "msw";

import { initialIdentities, state } from "../state";
import { initialStorageWorld } from "../storage-world";
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
import { messagingHandlers } from "./messaging";
import { initialLeads, leadHandlers } from "./leads";
import { initialListings, listingHandlers } from "./listings";
import { portfolioHandlers } from "./portfolio";
import { initialPortfolios } from "./portfolio-world";
import { releaseHandlers } from "./release";
import { settingsHandlers } from "./settings";
import { storageHandlers } from "./storage";
import { agencyHandlers, initialAgencyWorld } from "./agency";
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
  ...storageHandlers,
  ...agencyHandlers,
  ...portfolioHandlers,
  ...listingHandlers,
  ...leadHandlers,
  ...landlordDocumentHandlers,
  ...messagingHandlers,
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
    "messagingChannels",
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
  if (!part || part === "identities") {
    state.identities = initialIdentities();
    state.identityVerifications = {};
    if (part) return true;
  }
  if (!part || part === "portfolio") {
    // Landlord portfolios and the sign-up (B7.1) live beside the owner world.
    state.portfolio = initialPortfolios();
    state.landlordSignedUp = false;
    state.listingWorld = initialListings();
    state.leads = initialLeads();
    state.stampDuty = {};
    state.leaseNotices = {};
    state.certificates = {};
    if (part) return true;
  }
  if (!part || part === "agency" || part === "portfolio") {
    // Mandates, co-broke and deals (G2) read the landlord portfolio: they reset with it.
    state.agency = initialAgencyWorld();
    state.agencySignedUp = false;
    if (part === "agency") return true;
  }
  if (!part || part === "storage") {
    // Storage of G1 (files, packages, quota overrides) lives beside the owner world.
    state.storage = initialStorageWorld();
    if (part) return true;
  }
  if (!part) {
    state.owner = fresh;
    state.stampDuty = {};
    state.leaseNotices = {};
    state.certificates = {};
    return true;
  }
  const keys = PARTS[part];
  if (!keys) return false;
  for (const key of keys) (state.owner as unknown as Record<string, unknown>)[key] = fresh[key];
  return true;
}

export { providerPays, residentAnswers, residentSigns };
export { storagePackagePaid, storagePricePublished } from "./storage";
