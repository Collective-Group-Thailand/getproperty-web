import { setRequestLocale } from "next-intl/server";

import { GateApp } from "@/features/owner/guard/GateApp";
import { readGateSession } from "@/features/owner/guard/server";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * The gate tablet (JW4, J-DESIGN §1.4 "the gate is a tool"): its own minimal frame — no console rail, no console
 * providers — signed in with the guard's own cookies (`/bff/guard`). Landscape 1180 × 820 and portrait 820 × 1180.
 */
export default async function GatePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await readGateSession();
  return <GateApp enrolled={session.enrolled} me={session.me} snapshot={session.snapshot} />;
}
