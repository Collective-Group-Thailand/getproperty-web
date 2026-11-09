import { getTranslations, setRequestLocale } from "next-intl/server";

import { HandoversView } from "@/features/owner/juristic/handovers/HandoversView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.handovers.list");
  return { title: t("title") };
}

/** Developer handovers from getbuild — the waiting ones first (JW3b, D-333). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HandoversView context={await ownerContext()} searchParams={await searchParams} />;
}
