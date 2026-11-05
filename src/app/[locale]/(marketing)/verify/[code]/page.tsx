import { getTranslations, setRequestLocale } from "next-intl/server";

import { VERIFIED_DOCUMENT_STATUS } from "@/domain/status";
import { StatusPanel } from "@/features/owner/marketing/Layout";
import { publicVerify } from "@/features/owner/marketing/verify/publicVerify";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { IconShield } from "@/ui/icons/glyphs/shield";

type Params = { params: Promise<{ locale: Locale; code: string }> };

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Public check of a document issued through getproperty (D-306, D-025): whoever holds a debt clearance certificate
 * (a buyer, a bank, the Land Office) scans its QR and sees whether it is genuine and still valid — the type, number,
 * status, dates, issuer and unit number, and the holder's initials only. Nothing else about the owner, never the
 * amounts. Not indexed, not cached, no referrer.
 */
export default async function VerifyDocumentPage({ params }: Params) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.collections.verify");
  const document = await publicVerify(code);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14 md:pb-24">
      <div className="flex flex-col gap-3">
        <p className="text-muted m-0 text-sm font-medium">{t("kicker")}</p>
        <h1 className="m-0 text-3xl text-balance md:text-4xl" data-testid="verify-title">
          {document ? t(`type.${document.documentType}`) : t("notFoundTitle")}
        </h1>
      </div>
      {document ? (
        <section
          aria-labelledby="verify-result"
          className="border-border bg-surface rounded-card shadow-card flex flex-col gap-6 border p-5 md:p-8"
          data-testid="verify-document"
          data-status={document.status}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="border-border bg-bg text-muted grid size-11 place-items-center rounded-full border">
                <Icon icon={IconShield} />
              </span>
              <div className="flex flex-col">
                <span id="verify-result" className="font-semibold">
                  {document.status === "valid" ? t("genuineValid") : t("genuineExpired")}
                </span>
                <span className="text-muted text-sm">{t("issuedBy", { issuer: document.issuer })}</span>
              </div>
            </div>
            <StatusBadgeOf map={VERIFIED_DOCUMENT_STATUS} value={document.status} />
          </div>
          <dl className="border-border m-0 grid grid-cols-2 border-t sm:grid-cols-3" data-testid="verify-facts">
            {(
              [
                [
                  "number",
                  t("number"),
                  <span key="n" className="font-mono">
                    {document.number}
                  </span>,
                ],
                [
                  "unit",
                  t("unit"),
                  <span key="u" className="font-mono">
                    {document.unitNo}
                  </span>,
                ],
                ["holder", t("holder"), document.holderInitials],
                ["asOf", t("asOf"), formatDate(document.asOf, locale, { style: "long" })],
                ["issued", t("issued"), formatDate(document.issuedAt, locale, { style: "long" })],
                ["validUntil", t("validUntil"), formatDate(document.validUntil, locale, { style: "long" })],
              ] as const
            ).map(([key, term, value]) => (
              <div key={key} className="border-border border-b py-3 pe-4" data-testid={`verify-${key}`}>
                <dt className="text-muted text-sm">{term}</dt>
                <dd className="m-0 mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted m-0 text-sm">{document.status === "valid" ? t("noteValid") : t("noteExpired")}</p>
        </section>
      ) : (
        <StatusPanel testId="verify-not-found" icon={IconSearch} body={t("notFoundBody")} />
      )}
      <p className="text-muted m-0 text-xs">{t("privacy")}</p>
    </div>
  );
}
