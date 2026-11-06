import { getTranslations, setRequestLocale } from "next-intl/server";

import { EvaluateView } from "@/features/owner/juristic/vendors/ContractsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.evaluate");
  return { title: t("page") };
}

/** The monthly evaluation of a contract (JW2b, D-331). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; contractId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, contractId } = await params;
  setRequestLocale(locale);
  return <EvaluateView context={await ownerContext()} contractId={contractId} searchParams={await searchParams} />;
}
