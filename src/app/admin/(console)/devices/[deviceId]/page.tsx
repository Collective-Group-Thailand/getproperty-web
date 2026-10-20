import { getTranslations } from "next-intl/server";

import { DeviceDetail } from "@/features/admin/fleet/DeviceDetail";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("devices") };
}

/** One device: health, config applied vs current, commands, events (F5 5.3). */
export default async function Page({ params }: { params: Promise<{ deviceId: string }> }) {
  const [{ deviceId }, context] = await Promise.all([params, adminContext()]);
  return <DeviceDetail context={context} deviceId={deviceId} />;
}
