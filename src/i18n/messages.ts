import type { Zone } from "@/lib/zones";

import type { Locale } from "./routing";

/**
 * Messages are split by area and feature (F1 1.3 §2): `messages/<locale>/common/<file>.json` is loaded
 * for every zone at the top level (`shell`, `errors`, `status`…), and
 * `messages/<locale>/<zone>/<file>.json` only for that zone, under the zone's key (`owner.nav`,
 * `staff.offline`…). The staff bundle therefore never carries the admin's copy.
 *
 * The file list is explicit so the bundler can resolve each import; `messages.test.ts` fails when a
 * file on disk is missing here (or the other way round) and when th and en differ in keys.
 */
export const MESSAGE_FILES = {
  common: ["auth", "brand", "common", "console", "errors", "glossary", "notifications", "shell", "status"],
  owner: [
    "access",
    "arrears",
    "billing",
    "buildings",
    "common",
    "community",
    "dashboard",
    "deposits",
    "devices",
    "documents",
    "etax",
    "insights",
    "invoices",
    "leads",
    "leases",
    "listings",
    "loss",
    "marketing",
    "meters",
    "nav",
    "parties",
    "payments",
    "portfolio",
    "rates",
    "reports",
    "service",
    "settings",
    "subscription",
    "tm30",
    "units",
  ],
  staff: [
    "capture",
    "devices",
    "inspections",
    "lock",
    "nav",
    "offline",
    "parcels",
    "readings",
    "shell",
    "today",
    "work",
  ],
  admin: [
    "billing",
    "credentials",
    "fleet",
    "listings",
    "nav",
    "operations",
    "platform",
    "shell",
    "support",
    "tariffs",
    "tenants",
  ],
} as const satisfies Record<"common" | Zone, readonly string[]>;

type Messages = Record<string, unknown>;

async function load(locale: Locale, area: "common" | Zone, file: string): Promise<Messages> {
  const loaded = (await import(`./messages/${locale}/${area}/${file}.json`)) as { default: Messages };
  return loaded.default;
}

export async function loadMessages(locale: Locale, zone: Zone): Promise<Messages> {
  const [common, own] = await Promise.all([
    Promise.all(MESSAGE_FILES.common.map(async (file) => [file, await load(locale, "common", file)] as const)),
    Promise.all(MESSAGE_FILES[zone].map(async (file) => [file, await load(locale, zone, file)] as const)),
  ]);
  return { ...Object.fromEntries(common), [zone]: Object.fromEntries(own) };
}
