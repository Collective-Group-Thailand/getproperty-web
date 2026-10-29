import { getTranslations, setRequestLocale } from "next-intl/server";

import { HandoffClaimView } from "@/features/owner/handoffs/HandoffsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.network.claim");
  return { title: t("title"), referrer: "no-referrer" as const };
}

/** Claim a getbuild rental invitation with its token: rent, headline → a listing draft (G8, D-299). */
export default async function ClaimHandoff({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  return <HandoffClaimView context={await ownerContext()} token={token} />;
}
