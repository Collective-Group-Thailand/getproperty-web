import { getTranslations, setRequestLocale } from "next-intl/server";

import { RegisterUnitView } from "@/features/owner/juristic/RegisterUnitView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.register");
  return { title: t("title") };
}

/** One unit of the register (JW1a): owners and shares, bill-to, invite codes, history, facts. */
export default async function JuristicRegisterUnit({
  params,
}: {
  params: Promise<{ locale: Locale; unitId: string }>;
}) {
  const { locale, unitId } = await params;
  setRequestLocale(locale);
  return <RegisterUnitView context={await ownerContext()} unitId={unitId} />;
}
