import { getTranslations, setRequestLocale } from "next-intl/server";

import { ListingEditorView } from "@/features/owner/listings/ListingEditorView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("listings") };
}

/** One listing: photos, details, viewing times, verification, publish (F6.2, D-252). */
export default async function Listing({ params }: { params: Promise<{ locale: Locale; listingId: string }> }) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <ListingEditorView context={await ownerContext()} listingId={listingId} />;
}
