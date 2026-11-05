import { getTranslations, setRequestLocale } from "next-intl/server";

import { GateAdminView } from "@/features/owner/gate/GateAdminView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.gate");
  return { title: t("title") };
}

/** The gate admin of a juristic office (JW4, J4.1 + J4.2): gates, tablets, guards, policies, logs, settings. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GateAdminView context={await ownerContext()} searchParams={await searchParams} />;
}
