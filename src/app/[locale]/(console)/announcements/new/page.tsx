import { getTranslations, setRequestLocale } from "next-intl/server";

import { ComposeView } from "@/features/owner/community/ComposeView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.community.compose");
  return { title: t("pageTitle") };
}

/** Compose an announcement (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComposeView context={await ownerContext()} />;
}
