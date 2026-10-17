import { getTranslations } from "next-intl/server";

import { buildingDevices } from "@/features/staff/devices/server";
import { SwapWizard } from "@/features/staff/devices/SwapWizard";
import { staffScope } from "@/features/staff/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.devices.swap");
  return { title: t("title") };
}

/** Meter replacement (F4 4.3, `POST /v1/staff/devices/actions/swap`). */
export default async function StaffSwap({ searchParams }: { searchParams: Promise<{ meter?: string }> }) {
  const [{ meter }, scope] = await Promise.all([searchParams, staffScope()]);
  const { points } = await buildingDevices(scope);
  return <SwapWizard points={points} initialMeter={meter} />;
}
