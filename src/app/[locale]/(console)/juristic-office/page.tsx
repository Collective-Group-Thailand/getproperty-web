import { getTranslations, setRequestLocale } from "next-intl/server";

import { OfficeInvitationsView } from "@/features/owner/juristic/collections/WorkspaceView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.collections.office");
  return { title: t("title") };
}

/** A landlord invites its condo's juristic office (D-270, JW1b). */
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OfficeInvitationsView context={await ownerContext()} />;
}
