import { getTranslations } from "next-intl/server";

import { ProvisionGateway } from "@/features/staff/devices/ProvisionGateway";
import { buildingDevices } from "@/features/staff/devices/server";
import { staffScope } from "@/features/staff/shared/server";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconGateway } from "@/ui/icons/glyphs/gateway";

export async function generateMetadata() {
  const t = await getTranslations("staff.devices.provision");
  return { title: t("title") };
}

/** Gateway provisioning by QR (F4 4.3, `POST /v1/staff/devices/actions/provision`). */
export default async function StaffProvision({ searchParams }: { searchParams: Promise<{ serial?: string }> }) {
  const [{ serial }, scope] = await Promise.all([searchParams, staffScope()]);
  const t = await getTranslations("staff.devices");
  if (!scope.buildingId) return <EmptyState icon={IconGateway} title={t("noBuilding")} />;
  const { devices } = await buildingDevices(scope);
  const candidates = devices.filter(
    (device) => device.kind === "gateway" && (device.status === "assigned" || device.status === "inventory"),
  );
  return (
    <ProvisionGateway buildingId={scope.buildingId} candidates={candidates} initialSerial={serial?.slice(0, 64)} />
  );
}
