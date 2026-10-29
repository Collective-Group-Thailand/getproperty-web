import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { adminCampaign, broadcastWorld } from "../owner/broadcast";
import { body, idempotent, json, notFound, paged, platform, problem, query, record, validation } from "./support";

type Schemas = components["schemas"];

/*
 * Pack G6 on the admin surface (D-300, D-291; O-023): every buyer's sponsored campaigns (aggregates only) and their
 * rejection; the eight broadcast settings, each changed one a new version with the reason; a new
 * `platform.recommendations` consent text (th + en) — once in force everyone is asked again (consenting → 0).
 */

const QUIET = /^([01]\d|2[0-3]):[0-5]\d$/;

function settingsDto(): Schemas["BroadcastSettingsDto"] {
  const w = broadcastWorld();
  return {
    enabled: w.enabled,
    maxPerWeek: w.maxPerWeek,
    quietHours: w.quietHours,
    maxListings: w.maxListings,
    sendWindowHours: w.sendWindowHours,
    attributionDays: w.attributionDays,
    deliveryKeepMonths: w.deliveryKeepMonths,
    preferencesKeepDays: w.preferencesKeepDays,
    consentText: w.consentText,
    consenting: w.consenting,
  };
}

const RANGES: Record<string, [number, number]> = {
  maxPerWeek: [0, 7],
  maxListings: [1, 10],
  sendWindowHours: [1, 168],
  attributionDays: [1, 60],
  deliveryKeepMonths: [1, 36],
  preferencesKeepDays: [0, 90],
};

export const broadcastAdminHandlers: HttpHandler[] = [
  http.get("*/v1/admin/sponsored-campaigns", ({ request }) => {
    const ok = platform(request, "admin.sponsoredCampaigns.list", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    const rows = broadcastWorld()
      .campaigns.filter((c) => !wanted || c.state === wanted)
      .map(adminCampaign);
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/sponsored-campaigns/:campaignId/actions/reject", async ({ request, params }) => {
    const op = "admin.sponsoredCampaigns.reject";
    const ok = platform(request, op, "admin.listing.moderate");
    if (ok instanceof Response) return ok;
    const c = broadcastWorld().campaigns.find((x) => x.id === params.campaignId);
    if (!c) return notFound(op);
    const input = await body<{ reason?: string }>(request);
    record(op, request, input);
    const reason = String(input.reason ?? "").trim();
    if (!reason || reason.length > 500) return validation(op, "reason", "1–500 characters");
    if (c.state !== "draft" && c.state !== "scheduled" && c.state !== "sending")
      return problem(op, "broadcast.invalid_state");
    Object.assign(c, { state: "rejected", rejectReason: reason, completedAt: new Date().toISOString() });
    return json(adminCampaign(c));
  }),
  http.get("*/v1/admin/broadcast/settings", ({ request }) => {
    const ok = platform(request, "admin.broadcast.settings", "admin.setting.manage");
    if (ok instanceof Response) return ok;
    return json(settingsDto());
  }),
  http.put("*/v1/admin/broadcast/settings", async ({ request }) => {
    const op = "admin.broadcast.updateSettings";
    const ok = platform(request, op, "admin.setting.manage");
    if (ok instanceof Response) return ok;
    const input = await body<Partial<Schemas["BroadcastSettingsUpdateDto"]>>(request);
    record(op, request, input);
    if (!String(input.reason ?? "").trim()) return validation(op, "reason", "required");
    for (const [key, [min, max]] of Object.entries(RANGES)) {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || (value as number) < min || (value as number) > max)
        return validation(op, key, `${min}–${max}`, "range");
    }
    if (input.quietHours && (!QUIET.test(input.quietHours.start) || !QUIET.test(input.quietHours.end)))
      return validation(op, "quietHours", "HH:mm");
    const w = broadcastWorld();
    if (typeof input.enabled === "boolean") w.enabled = input.enabled;
    for (const key of Object.keys(RANGES)) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "number") (w as unknown as Record<string, number>)[key] = value;
    }
    if (input.quietHours) w.quietHours = { ...input.quietHours, timezone: "Asia/Bangkok" };
    return json(settingsDto());
  }),
  http.post("*/v1/admin/broadcast/consent-texts", async ({ request }) => {
    const op = "admin.broadcast.publishConsentText";
    const ok = platform(request, op, "admin.setting.manage");
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (payload) => {
      const input = payload as Partial<Schemas["BroadcastConsentTextCreateDto"]>;
      for (const lang of ["th", "en"] as const) {
        if (!input[lang]?.title?.trim()) return validation(op, `${lang}.title`, "required");
        if (!input[lang]?.bodyMarkdown?.trim()) return validation(op, `${lang}.bodyMarkdown`, "required");
      }
      const from = input.effectiveFrom ? Date.parse(input.effectiveFrom) : Date.now();
      if (Number.isNaN(from) || from < Date.now() - 60_000)
        return validation(op, "effectiveFrom", "from now, never backdated", "range");
      const w = broadcastWorld();
      const text: Schemas["BroadcastConsentTextDto"] = {
        version: w.consentText.version + 1,
        effectiveFrom: new Date(from).toISOString(),
        th: input.th!,
        en: input.en!,
      };
      // In force now: every earlier grant counts as not granted — nobody is reached until they consent again (D-300).
      // (A text from a later date replaces the one shown at once in the mock; the API keeps both until then.)
      w.consentText = text;
      if (from <= Date.now() + 60_000) w.consenting = 0;
      return { status: 201, body: text };
    });
  }),
];
