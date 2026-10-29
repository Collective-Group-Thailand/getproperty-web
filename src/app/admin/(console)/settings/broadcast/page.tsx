import { getTranslations } from "next-intl/server";

import { BroadcastSettingsView } from "@/features/admin/growth/BroadcastSettingsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.broadcast.settings");
  return { title: t("title") };
}

/** Settings — sponsored LINE broadcasts: the switch (O-023), caps and windows, the consent text (G6, D-300). */
export default async function Page() {
  return <BroadcastSettingsView context={await adminContext()} />;
}
