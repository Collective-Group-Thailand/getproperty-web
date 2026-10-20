import { getTranslations } from "next-intl/server";

import { RolloutDetail } from "@/features/admin/fleet/OtaView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("ota_releases") };
}

/** One OTA rollout with live progress (F5 5.3). */
export default async function Page({ params }: { params: Promise<{ rolloutId: string }> }) {
  const [{ rolloutId }, context] = await Promise.all([params, adminContext()]);
  return <RolloutDetail context={context} rolloutId={rolloutId} />;
}
