import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClearanceView } from "@/features/owner/juristic/collections/ClearanceView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.clearance");
  return { title: t("metaRecord") };
}

/** One debt clearance request or certificate (JW1b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; clearanceId: string }> }) {
  const { locale, clearanceId } = await params;
  setRequestLocale(locale);
  return <ClearanceView context={await ownerContext()} clearanceId={clearanceId} />;
}
