import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactsView } from "@/features/owner/community/ContactsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.community.contacts");
  return { title: t("title") };
}

/** Contacts residents see (F2 2.7). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactsView context={await ownerContext()} />;
}
