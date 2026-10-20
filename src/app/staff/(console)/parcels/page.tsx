import { getTranslations } from "next-intl/server";

import { ParcelsView } from "@/features/staff/parcels/ParcelsView";
import { intakeUnits } from "@/features/staff/parcels/server";
import { staffScope } from "@/features/staff/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.parcels");
  return { title: t("title") };
}

/** Parcel intake and pick-up (F4 4.4). */
export default async function StaffParcels() {
  const scope = await staffScope();
  return <ParcelsView scope={scope} units={await intakeUnits(scope)} />;
}
