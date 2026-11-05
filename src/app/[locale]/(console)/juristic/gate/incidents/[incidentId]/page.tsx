import { getTranslations, setRequestLocale } from "next-intl/server";

import { IncidentRecordView } from "@/features/owner/gate/GateLogs";
import { ownerContext } from "@/features/owner/shared/server";
import { param } from "@/features/shared/console/params";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.gate");
  return { title: t("incident.recordTitle") };
}

/** One record of the gate log (JW4): read with the reason given on the log (audited by the API, D-315). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; incidentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, incidentId } = await params;
  setRequestLocale(locale);
  return (
    <IncidentRecordView
      context={await ownerContext()}
      incidentId={incidentId}
      reason={param((await searchParams).reason)}
    />
  );
}
