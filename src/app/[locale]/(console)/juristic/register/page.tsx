import { getTranslations, setRequestLocale } from "next-intl/server";

import { RegisterView } from "@/features/owner/juristic/RegisterView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.register");
  return { title: t("title") };
}

/** The co-owner register (JW1a): plots by soi or floors of a building, owners and shares, bill-to, channels. */
export default async function JuristicRegister({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RegisterView context={await ownerContext()} searchParams={await searchParams} />;
}
