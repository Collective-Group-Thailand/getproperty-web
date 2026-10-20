import { getTranslations, setRequestLocale } from "next-intl/server";

import { LockDetail } from "@/features/owner/access/LockDetail";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.access");
  return { title: t("metaTitle") };
}

/** One lock: credentials, codes, unlock log (F2 2.7). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; lockId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, lockId } = await params;
  setRequestLocale(locale);
  return <LockDetail context={await ownerContext()} lockId={lockId} searchParams={await searchParams} />;
}
