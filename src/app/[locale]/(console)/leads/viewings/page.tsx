import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerContext } from "@/features/owner/shared/server";
import { ViewingCalendarView } from "@/features/owner/viewings/ViewingCalendarView";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.viewings.calendar");
  return { title: t("title") };
}

/** The viewing calendar: a week of accompanied and self viewings with their door-code state (G7, D-295). */
export default async function ViewingCalendar({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { locale } = await params;
  const { week } = await searchParams;
  setRequestLocale(locale);
  return <ViewingCalendarView context={await ownerContext()} week={week} />;
}
