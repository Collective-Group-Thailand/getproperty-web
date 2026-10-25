import { getTranslations, setRequestLocale } from "next-intl/server";

import { SignInMethodsView } from "@/features/owner/settings/SignInMethodsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.settings.signIn");
  return { title: t("title") };
}

/** My ways to sign in: phone, password, Google, Apple, LINE (D-255, D-283). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignInMethodsView context={await ownerContext()} searchParams={await searchParams} />;
}
