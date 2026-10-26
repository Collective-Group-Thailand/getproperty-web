import { getTranslations, setRequestLocale } from "next-intl/server";

import { IdentityVerificationView } from "@/features/owner/settings/IdentityVerificationView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.settings.verification");
  return { title: t("title") };
}

/** Verify my identity at the e-KYC provider (D-267, O-021); the provider sends me back here. */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <IdentityVerificationView context={await ownerContext()} />;
}
