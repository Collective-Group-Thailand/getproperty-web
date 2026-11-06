import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import type { OwnerContext } from "../../shared/server";
import { parseBands } from "../accounting/bands";
import { parseWhtRates } from "../accounting/wht";
import { renewalWindows } from "./contracts";
import { parseCriteria } from "./evaluations";

/**
 * The settings the vendor pages read (J2.2): the quotation threshold, the expiry alert days (the renewal queue's
 * windows), the instalment lead days, the evaluation criteria, and J2.1's approval bands and WHT rates. Values come
 * from the API's settings list; a value the list does not carry stays unknown (`null` / empty) — never a default here.
 */
export async function vendorSettings(context: OwnerContext) {
  const settings = await unwrap(context.api.GET("/v1/owner/settings", { params: { query: {} } })).catch(
    () => [] as Schemas["SettingDto"][],
  );
  const value = (key: string) => settings.find((setting) => setting.key === key)?.value;
  const threshold = value("juristic.quotation_threshold");
  const lead = value("juristic.contract_instalment_lead_days");
  return {
    threshold: typeof threshold === "string" ? threshold : null,
    windows: renewalWindows(value("juristic.contract_expiry_alert_days")),
    leadDays: typeof lead === "number" ? lead : null,
    criteria: parseCriteria(value("juristic.vendor_evaluation_criteria")),
    bands: parseBands(value("juristic.approval_bands")),
    rates: parseWhtRates(value("juristic.wht_rates")),
  };
}

/** Vendors for pickers (active first, by name); empty when the list is not readable. */
export async function vendorChoices(api: ApiClient, state?: Schemas["VendorState"]): Promise<Schemas["VendorDto"][]> {
  return unwrap(
    api.GET("/v1/owner/juristic/vendors", { params: { query: { perPage: 100, ...(state ? { state } : {}) } } }),
  )
    .then((list) => list.data)
    .catch(() => []);
}

/** Contracts for pickers (a building's, a state's); empty when the list is not readable. */
export async function contractChoices(
  api: ApiClient,
  query: { buildingId?: string; state?: Schemas["VendorContractState"]; vendorId?: string } = {},
): Promise<Schemas["VendorContractDto"][]> {
  return unwrap(api.GET("/v1/owner/juristic/vendor-contracts", { params: { query: { perPage: 100, ...query } } }))
    .then((list) => list.data)
    .catch(() => []);
}

/**
 * Awarded quotation rounds as `{ id, buildingId, vendorId, label }` — the vendor is the awarded quotation's. Only
 * these may back a contract or a vendor purchase above the threshold.
 */
export async function awardedRounds(
  api: ApiClient,
  label: (round: Schemas["QuotationRoundDto"]) => string,
): Promise<{ id: string; buildingId: string; vendorId: string; label: string }[]> {
  return unwrap(
    api.GET("/v1/owner/juristic/quotation-rounds", { params: { query: { state: "awarded", perPage: 100 } } }),
  )
    .then((list) =>
      list.data.flatMap((round) => {
        const awarded = round.quotations.find((quote) => quote.id === round.awardedQuotationId);
        return awarded
          ? [{ id: round.id, buildingId: round.buildingId, vendorId: awarded.vendorId, label: label(round) }]
          : [];
      }),
    )
    .catch(() => []);
}
