import { getTranslations } from "next-intl/server";

import { MODERATION_TABS, ModerationView, type ModerationTab } from "@/features/admin/listings/ModerationView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("listings") };
}

/** Listing moderation and owner verification (F6.5, D-252). */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const current = MODERATION_TABS.includes(tab as ModerationTab) ? (tab as ModerationTab) : "queue";
  return <ModerationView context={await adminContext()} tab={current} />;
}
