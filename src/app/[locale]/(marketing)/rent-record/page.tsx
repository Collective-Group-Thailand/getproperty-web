import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

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
    <section className="bg-surface-subtle">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
        <div className="flex flex-col gap-2">
          <p className="text-primary text-sm font-semibold">{t("kicker")}</p>
          <h1 className="text-display">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <RentRecordCheck locale={locale} />
      </div>
    </section>
  );
}
