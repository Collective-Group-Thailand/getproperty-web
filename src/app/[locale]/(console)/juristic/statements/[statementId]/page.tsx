import { getTranslations, setRequestLocale } from "next-intl/server";

import { StatementView } from "@/features/owner/juristic/collections/StatementsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.statements");
  return { title: t("metaRecord") };
}

/** One owner statement as paper (JW1b, J-DESIGN §4). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; statementId: string }> }) {
  const { locale, statementId } = await params;
  setRequestLocale(locale);
  return <StatementView context={await ownerContext()} statementId={statementId} />;
}
