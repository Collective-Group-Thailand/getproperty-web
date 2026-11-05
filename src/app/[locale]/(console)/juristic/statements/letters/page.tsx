import { getTranslations, setRequestLocale } from "next-intl/server";

import { LettersView } from "@/features/owner/juristic/collections/StatementsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.letters");
  return { title: t("title") };
}

/** Printed letter batches (JW1b, D-307). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LettersView context={await ownerContext()} searchParams={await searchParams} />;
}
