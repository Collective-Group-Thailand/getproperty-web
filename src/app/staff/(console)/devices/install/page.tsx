import { getTranslations } from "next-intl/server";

import { InstallWizard } from "@/features/staff/devices/InstallWizard";
import { buildingDevices, USABLE_GATEWAY } from "@/features/staff/devices/server";
import { staffScope } from "@/features/staff/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.devices.install");
  return { title: t("title") };
}

/** The meter binding wizard (F4 4.3, `POST /v1/staff/devices/actions/install`). */
export default async function StaffInstall({
  searchParams,
}: {
  searchParams: Promise<{ meter?: string; gateway?: string }>;
}) {
  const [{ meter, gateway }, scope] = await Promise.all([searchParams, staffScope()]);
  const { devices, points, drivers } = await buildingDevices(scope);
  return (
    <InstallWizard
      points={points}
      gateways={devices.filter((device) => device.kind === "gateway" && USABLE_GATEWAY.has(device.status))}
      inventory={devices.filter(
        (device) => device.kind !== "gateway" && (device.status === "assigned" || device.status === "inventory"),
      )}
      drivers={drivers}
      initial={{ meter, gateway }}
    />
  );
}
