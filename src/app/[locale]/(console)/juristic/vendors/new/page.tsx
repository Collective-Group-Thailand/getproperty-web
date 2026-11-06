import { getTranslations, setRequestLocale } from "next-intl/server";

import { VendorFormView } from "@/features/owner/juristic/vendors/VendorsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.form");
  return { title: t("title") };
}

/** A new vendor (JW2b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VendorFormView context={await ownerContext()} />;
}
