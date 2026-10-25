import { getTranslations, setRequestLocale } from "next-intl/server";

import { CertificatesView } from "@/features/owner/landlord-docs/CertificatesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.certificates");
  return { title: t("title") };
}

/** Rent payment certificates: requests to answer and certificates issued (B7.5, D-253). */
export default async function Certificates({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CertificatesView context={await ownerContext()} />;
}
