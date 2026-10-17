import { z } from "zod";

/*
 * CONTRACT-REQUEST — endpoints this app needs that the pinned contract does not publish yet
 * (docs/contract-requests.md). Their shapes are the *requested* ones, written here with zod so the
 * response is validated at runtime; each is deleted for the generated type the day the contract
 * adopts the endpoint. The mock API implements them (mocks/handlers/contract-requests.ts).
 */

/** `GET /v1/owner/search?q=` — global search in the owner console. */
export const searchResultsSchema = z.object({
  data: z.array(
    z.object({
      type: z.enum(["building", "unit", "party", "lease", "invoice"]),
      id: z.string(),
      label: z.string(),
      sublabel: z.string().nullable(),
    }),
  ),
});
export type SearchResult = z.infer<typeof searchResultsSchema>["data"][number];

/** `GET /v1/public/plans` — the price plans of the pricing page (D-156), no authentication. */
export const publicPlansSchema = z.object({
  data: z.array(
    z.object({
      key: z.string(),
      tenantType: z.enum(["apartment", "condo_juristic", "pm_company", "landlord"]),
      name: z.string(),
      summary: z.string(),
      /** Decimal string, VAT excluded (contract §3 money). */
      pricePerUnit: z.string().nullable(),
      priceUnit: z.enum(["unit_month", "building_month", "building_year", "month"]),
      minimumUnits: z.int().nullable(),
      currency: z.literal("THB"),
      features: z.array(z.string()),
    }),
  ),
});
export type PublicPlan = z.infer<typeof publicPlansSchema>["data"][number];

/** `GET /v1/public/utility-tariffs/current?utility=&provider=` — the loss-calculator teaser, no authentication. */
export const publicTariffSchema = z.object({
  utility: z.enum(["electric", "water"]),
  provider: z.enum(["mea", "pea", "mwa", "pwa"]),
  nameTh: z.string(),
  tariffCode: z.string(),
  /** Highest lawful charge per unit the tenant may pass on (decimal string, D-021). */
  ceilingPerUnit: z.string(),
  effectiveFrom: z.string(),
  sourceUrl: z.string(),
});
export type PublicTariff = z.infer<typeof publicTariffSchema>;

/** `POST /v1/{owner,staff,admin}/telemetry/web-vitals` — Web Vitals RUM through the BFF. */
export const webVitalSchema = z.object({
  name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]),
  value: z.number(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  id: z.string(),
  route: z.string(),
  navigationType: z.string().optional(),
});
export type WebVital = z.infer<typeof webVitalSchema>;

/** `POST /v1/staff/readings` — one meter reading from the staff PWA (F4; offline queue target, ADR-0007). */
export const staffReadingSchema = z.object({
  meterId: z.uuid(),
  /** Decimal string, ≤ 3 decimals (contract §3 meter quantities). */
  register: z.string().regex(/^\d+(\.\d{1,3})?$/),
  readAt: z.string(),
  source: z.enum(["ocr", "manual"]),
  photoFileId: z.uuid().nullable(),
});
export type StaffReading = z.infer<typeof staffReadingSchema>;
