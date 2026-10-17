import { getTranslations, setRequestLocale } from "next-intl/server";

import { LeaseDetail } from "@/features/owner/leases/LeaseDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("leases") };
}

/** One lease (F2 2.2). */
export default async function Lease({ params }: { params: Promise<{ locale: Locale; leaseId: string }> }) {
  const { locale, leaseId } = await params;
  setRequestLocale(locale);
  return <LeaseDetail context={await ownerContext()} leaseId={leaseId} />;
}
