import { getTranslations, setRequestLocale } from "next-intl/server";

import { InvitesView } from "@/features/owner/juristic/InvitesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.juristic.invites");
  return { title: t("title") };
}

/** Resident invite codes in a batch (JW1a, JR): choose units, create the codes, print the QR sheet. */
export default async function JuristicInvites({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InvitesView context={await ownerContext()} searchParams={await searchParams} />;
}
