import { getTranslations } from "next-intl/server";

import { InspectionList } from "@/features/staff/inspections/InspectionList";
import { unwrap } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.inspections");
  return { title: t("title") };
}

/** Move-in / move-out inspections of my buildings (F4 4.2, `GET /v1/staff/inspections`). */
export default async function StaffInspections() {
  const api = await serverApi("staff");
  const page = await unwrap(api.GET("/v1/staff/inspections", { params: { query: { perPage: 100 } } }));
  return <InspectionList inspections={page.data} />;
}
