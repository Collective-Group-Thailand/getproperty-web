import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReceivablesView } from "@/features/owner/juristic/collections/ReceivablesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.receivables");
  return { title: t("title") };
}

/** Receivables of the juristic office (JW1b, J-DESIGN §3). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReceivablesView context={await ownerContext()} searchParams={await searchParams} />;
}
