import { getTranslations, setRequestLocale } from "next-intl/server";

import { RequestDetail } from "@/features/owner/service/RequestDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.service.request");
  return { title: t("metaTitle") };
}

/** One service request (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; serviceRequestId: string }> }) {
  const { locale, serviceRequestId } = await params;
  setRequestLocale(locale);
  return <RequestDetail context={await ownerContext()} serviceRequestId={serviceRequestId} />;
}
