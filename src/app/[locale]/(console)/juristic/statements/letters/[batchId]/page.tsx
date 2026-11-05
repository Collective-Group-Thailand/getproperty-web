import { getTranslations, setRequestLocale } from "next-intl/server";

import { LetterBatchView } from "@/features/owner/juristic/collections/StatementsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.letters");
  return { title: t("metaRecord") };
}

/** One letter batch with its print (JW1b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; batchId: string }> }) {
  const { locale, batchId } = await params;
  setRequestLocale(locale);
  return <LetterBatchView context={await ownerContext()} batchId={batchId} />;
}
