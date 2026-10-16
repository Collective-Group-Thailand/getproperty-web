import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ZoneDocument, zoneMetadata } from "@/features/shared/shell/ZoneDocument";
import { routing } from "@/i18n/routing";

type Params = Promise<{ locale: string }>;

/** Owner zone root layout — `localhost:3000`, Thai at `/`, English under `/en` (00-master-plan.md §2). */
export async function generateMetadata({ params }: { params: Params }) {
  // Metadata is resolved before the layout renders, so the locale must be set here too or the
  // request config falls back to the cookie and `/en` would be titled in Thai.
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) setRequestLocale(locale);
  return zoneMetadata("owner");
}

export default async function OwnerLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ZoneDocument zone="owner">{children}</ZoneDocument>;
}
