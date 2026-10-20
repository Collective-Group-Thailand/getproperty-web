import { getTranslations } from "next-intl/server";

import { SettingsView } from "@/features/admin/platform/SettingsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("settings") };
}

/** Platform settings, effective-dated (F5 5.2). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SettingsView context={await adminContext()} searchParams={await searchParams} />;
}
