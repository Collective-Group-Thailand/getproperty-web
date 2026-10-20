import { getTranslations } from "next-intl/server";

import { OtaView } from "@/features/admin/fleet/OtaView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("ota_releases") };
}

/** OTA releases and ring rollouts (F5 5.3). */
export default async function Page() {
  return <OtaView context={await adminContext()} />;
}
