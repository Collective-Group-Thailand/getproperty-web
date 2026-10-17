import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.nav");
  return { title: t("today") };
}

/** Today's work — the reading round and tasks are F4 4.1. */
export default async function StaffToday() {
  const t = await getTranslations("staff.nav");
  return (
    <div className="py-6" data-testid="staff-today">
      <h1 className="text-2xl font-semibold">{t("today")}</h1>
    </div>
  );
}
