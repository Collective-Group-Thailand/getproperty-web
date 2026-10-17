import { getTranslations } from "next-intl/server";

import { staffScope } from "@/features/staff/shared/server";
import { TodayView } from "@/features/staff/today/TodayView";
import { requireOperator } from "@/lib/auth/guards";

export async function generateMetadata() {
  const t = await getTranslations("staff.nav");
  return { title: t("today") };
}

/** Today's work (F4 4.1 §1). */
export default async function StaffToday() {
  const [actor, scope] = await Promise.all([
    requireOperator("staff", { login: "/login", selectTenant: "/select-tenant" }),
    staffScope(),
  ]);
  return <TodayView scope={scope} menu={actor.me.menu} />;
}
