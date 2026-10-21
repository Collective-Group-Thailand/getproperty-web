import { getTranslations, setRequestLocale } from "next-intl/server";

import { EtaxDetail } from "@/features/owner/etax/EtaxDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.etax");
  return { title: t("title") };
}

/** One e-Tax submission (B6.2, D-215). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; submissionId: string }> }) {
  const { locale, submissionId } = await params;
  setRequestLocale(locale);
  return <EtaxDetail context={await ownerContext()} submissionId={submissionId} />;
}
