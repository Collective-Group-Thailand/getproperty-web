import { getTranslations, setRequestLocale } from "next-intl/server";

import { VendorView } from "@/features/owner/juristic/vendors/VendorsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.vendors.record");
  return { title: t("back") };
}

/** One vendor: details, contracts, evaluations, block (JW2b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; vendorId: string }> }) {
  const { locale, vendorId } = await params;
  setRequestLocale(locale);
  return <VendorView context={await ownerContext()} vendorId={vendorId} />;
}
