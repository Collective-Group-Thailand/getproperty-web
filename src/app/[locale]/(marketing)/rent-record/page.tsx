import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { TaskPage } from "@/features/owner/marketing/Layout";
import { RentRecordCheck } from "@/features/owner/rentRecord/RentRecordCheck";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale }> };
type Props = Params & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.rentRecord.check");
  return { title: t("title"), robots: { index: false, follow: true } };
}

/** Where a landlord types the code from a resident's rent record letter (D-256). */
export default async function RentRecordCheckPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  if (/^[0-9A-Z]{10}$/.test(code)) redirect(getPathname({ href: `/rent-record/${code}`, locale }));
  const t = await getTranslations("owner.rentRecord.check");
  return (
    <TaskPage eyebrow={t("kicker")} title={t("title")} lede={t("lead")}>
      <RentRecordCheck locale={locale} />
    </TaskPage>
  );
}
