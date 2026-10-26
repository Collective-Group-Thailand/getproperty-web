import { getTranslations, setRequestLocale } from "next-intl/server";

import { publicRentRecord } from "@/features/owner/marketing/publicApi";
import { RentRecordCheck } from "@/features/owner/rentRecord/RentRecordCheck";
import { RentRecordSummary } from "@/features/owner/rentRecord/RentRecordSummary";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
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
    <section className="bg-surface-subtle">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
        <div className="flex flex-col gap-2">
          <p className="text-primary text-sm font-semibold">{t("kicker")}</p>
          <h1 className="text-display">{letter ? letter.holderName : t("notFoundTitle")}</h1>
        </div>
        {letter ? (
          <div
            className="border-border bg-surface rounded-card flex flex-col gap-5 border p-5"
            data-testid="rent-record-letter"
          >
            <div className="flex flex-wrap items-center gap-3">
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
          <div data-testid="rent-record-not-found">
            <Callout tone="warning">{t("notFound")}</Callout>
          </div>
        )}
        <RentRecordCheck locale={locale} />
      </div>
    </section>
  );
}
