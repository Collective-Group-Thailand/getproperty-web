import { getTranslations, setRequestLocale } from "next-intl/server";

import { VisitRecordView } from "@/features/owner/gate/GateLogs";
import { ownerContext } from "@/features/owner/shared/server";
import { param } from "@/features/shared/console/params";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.gate");
  return { title: t("log.recordTitle") };
}

/** One record of the gate log (JW4): read with the reason given on the log (audited by the API, D-315). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; visitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, visitId } = await params;
  setRequestLocale(locale);
  return (
    <VisitRecordView context={await ownerContext()} visitId={visitId} reason={param((await searchParams).reason)} />
  );
}
