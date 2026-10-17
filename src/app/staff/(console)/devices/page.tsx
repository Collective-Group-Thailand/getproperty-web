import { getTranslations } from "next-intl/server";

import { DevicesView } from "@/features/staff/devices/DevicesView";
import { buildingDevices } from "@/features/staff/devices/server";
import { staffScope } from "@/features/staff/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.devices");
  return { title: t("title") };
}

/** Devices and installs of the focused building (F4 4.3). */
export default async function StaffDevices() {
  const scope = await staffScope();
  return <DevicesView scope={scope} data={await buildingDevices(scope)} />;
}
