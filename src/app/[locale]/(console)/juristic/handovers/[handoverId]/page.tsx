import { getTranslations, setRequestLocale } from "next-intl/server";

import { HandoverReviewView } from "@/features/owner/juristic/handovers/HandoversView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.handovers.review");
  return { title: t("metaTitle") };
}

/** One developer handover: review, accept or reject, the juristic person's formation (JW3b, D-333). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; handoverId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, handoverId } = await params;
  setRequestLocale(locale);
  return (
    <HandoverReviewView context={await ownerContext()} handoverId={handoverId} searchParams={await searchParams} />
  );
}
