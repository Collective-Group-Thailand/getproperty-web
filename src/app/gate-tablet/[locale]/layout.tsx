import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GateDocument, gateMetadata } from "@/features/owner/guard/GateDocument";
import { zoneViewport } from "@/features/shared/shell/ZoneDocument";
import { routing } from "@/i18n/routing";

type Params = Promise<{ locale: string }>;

/**
 * Root layout of the gate tablet (JW4): `/gate` and `/en/gate` on the owner host are rewritten here by src/proxy.ts
 * (the `gate-tablet` segment itself is never reachable from outside). Its own document, not the console's.
 */
export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) setRequestLocale(locale);
  return gateMetadata();
}

export const viewport = { ...zoneViewport, width: "device-width", initialScale: 1 };

export default async function GateLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <GateDocument>{children}</GateDocument>;
}
