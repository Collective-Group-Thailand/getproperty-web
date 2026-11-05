import { getTranslations, setRequestLocale } from "next-intl/server";

import { CertificateView } from "@/features/owner/juristic/accounting/ExpensesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.accounting.certificates");
  return { title: t("paperKind") };
}

/** One 50 ทวิ certificate as paper (JW2a). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; certificateId: string }> }) {
  const { locale, certificateId } = await params;
  setRequestLocale(locale);
  return <CertificateView context={await ownerContext()} certificateId={certificateId} />;
}
