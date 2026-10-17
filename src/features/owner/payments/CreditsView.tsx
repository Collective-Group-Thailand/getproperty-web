import { getTranslations } from "next-intl/server";

import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section, type OwnerContext } from "../shared/server";
import { slipsToReview } from "./PaymentsView";
import { RefundButton } from "./RefundButton";

/**
 * Overpayment credits and refunds (F2 2.4, D-198): who holds a credit with the tenant, refund it (cash
 * or transfer with its slip); the latest receipts with their PDFs.
 */
export async function CreditsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.payments.credits");
  const { api, locale } = context;
  const [credits, receipts, slips] = await Promise.all([
    unwrap(api.GET("/v1/owner/payer-credits", { params: { query: {} } })),
    section(unwrap(api.GET("/v1/owner/receipts", { params: { query: { perPage: 20 } } }))),
    slipsToReview(api),
  ]);
  return (
    <OwnerPage testId="credits">
      <PageHeader title={t("title")} description={t("description")} />
      <MoneyNav section="payments" current="/payments/credits" locale={locale} counts={{ "/payments/slips": slips }} />
      <Card as="section" aria-labelledby="credit-list">
        <CardHeader title={<span id="credit-list">{t("credits")}</span>} description={t("creditsHint")} />
        {credits.length ? (
          <ul className="divide-border flex flex-col divide-y" data-testid="credit-list">
            {credits.map((credit) => (
              <li
                key={`${credit.partyId}-${credit.unitId ?? ""}`}
                className="flex flex-wrap items-center gap-3 py-3"
                data-testid="credit-row"
              >
                <span className="w-16 font-mono font-semibold">{credit.unitNo ?? "—"}</span>
                <a
                  className="flex-1 underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/parties/${credit.partyId}`)}
                >
                  {credit.partyName}
                </a>
                <span className="tabular-nums" data-testid="credit-balance">
                  {formatTHB(credit.balance, locale)}
                </span>
                <RefundButton credit={credit} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={IconWallet} title={t("empty")} />
        )}
      </Card>
      <Card as="section" aria-labelledby="receipt-list">
        <CardHeader title={<span id="receipt-list">{t("receipts")}</span>} description={t("receiptsHint")} />
        {receipts.data && receipts.data.data.length ? (
          <ul className="divide-border flex flex-col divide-y text-sm" data-testid="receipt-list">
            {receipts.data.data.map((receipt) => (
              <li key={receipt.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-40 font-mono">{receipt.number}</span>
                <span className="w-16 font-mono">{receipt.unitNo ?? "—"}</span>
                <span className="flex-1">{receipt.payerName}</span>
                <span className="text-muted">{formatDateTime(receipt.issuedAt, locale)}</span>
                <span className="tabular-nums">{formatTHB(receipt.amount, locale)}</span>
                {receipt.voidedAt ? <span className="text-muted">{t("voided")}</span> : null}
                {receipt.hasDocument ? (
                  <DocumentButton
                    document={{ kind: "receipt", id: receipt.id }}
                    label={t("pdf")}
                    title={receipt.number}
                    variant="ghost"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t("noReceipts")}</p>
        )}
      </Card>
    </OwnerPage>
  );
}
