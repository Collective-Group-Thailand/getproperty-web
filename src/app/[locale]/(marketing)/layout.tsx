import { setRequestLocale } from "next-intl/server";

import { MarketingFrame } from "@/features/owner/marketing/MarketingFrame";
import type { Locale } from "@/i18n/routing";

/** Public pages of the owner host (F1 1.3 §7) — the only indexable pages of this app. */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketingFrame locale={locale}>{children}</MarketingFrame>;
}
