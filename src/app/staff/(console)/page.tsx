import { getTranslations } from "next-intl/server";

import { staffScope } from "@/features/staff/shared/server";
import { TodayView } from "@/features/staff/today/TodayView";
import { requireOperator } from "@/lib/auth/guards";

export async function generateMetadata() {
  const t = await getTranslations("staff.nav");
  return { title: t("today") };
}

/** Today's work (F4 4.1 §1, 4.4 §1): the round and the day's tasks; `?mine=0` shows everyone's. */
export default async function StaffToday({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mine } = await searchParams;
  const [actor, scope] = await Promise.all([
    requireOperator("staff", { login: "/login", selectTenant: "/select-tenant" }),
    staffScope(),
  ]);
  return <TodayView scope={scope} menu={actor.me.menu} mine={mine !== "0"} />;
}
