import { getTranslations } from "next-intl/server";

import { staffScope } from "@/features/staff/shared/server";
import { WorkOrdersView } from "@/features/staff/work/WorkOrdersView";

export async function generateMetadata() {
  const t = await getTranslations("staff.work");
  return { title: t("title") };
}

/** My work orders and the building's open requests (F4 4.4). */
export default async function StaffWorkOrders() {
  return <WorkOrdersView scope={await staffScope()} />;
}
