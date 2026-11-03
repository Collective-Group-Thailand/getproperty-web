import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicRentRecord } from "@/features/owner/marketing/publicApi";
import { StatusPanel, TaskPage } from "@/features/owner/marketing/Layout";
import { RentRecordCheck } from "@/features/owner/rentRecord/RentRecordCheck";
import { RentRecordSummary } from "@/features/owner/rentRecord/RentRecordSummary";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { IconShield } from "@/ui/icons/glyphs/shield";

type Params = { params: Promise<{ locale: Locale; code: string }> };

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Check a rent record letter (D-256): a next landlord types or scans the code from the resident's letter and sees the
 * facts getproperty confirmed — only while the resident keeps the letter live. Not indexed; nothing is cached.
 */
export default async function RentRecordLetterPage({ params }: Params) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.rentRecord.check");
  const letter = await publicRentRecord(code);
  return (
    <TaskPage eyebrow={t("kicker")} title={letter ? letter.holderName : t("notFoundTitle")}>
      {letter ? (
        <div
          className="border-border bg-surface rounded-card shadow-card flex flex-col gap-5 border p-5 md:p-6"
          data-testid="rent-record-letter"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Badge tone="success" icon={IconShield}>
              {t("confirmed")}
            </Badge>
            <span className="text-muted text-sm">
              {t("validity", {
                issued: formatDate(letter.issuedAt, locale),
                expires: formatDate(letter.expiresAt, locale),
              })}
            </span>
          </div>
          <RentRecordSummary record={letter.record} locale={locale} />
        </div>
      ) : (
        <StatusPanel testId="rent-record-not-found" icon={IconSearch} body={t("notFound")} />
      )}
      <section aria-labelledby="check-another" className="flex flex-col gap-3">
        <h2 id="check-another" className="m-0 text-xl">
          {letter ? t("another") : t("tryAgain")}
        </h2>
        <RentRecordCheck locale={locale} />
      </section>
    </TaskPage>
  );
}
