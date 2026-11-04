import { getTranslations } from "next-intl/server";

import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { ReceiptRowMenu } from "./ReceiptRowMenu";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section, type OwnerContext } from "../shared/server";
import { RefundButton } from "./RefundButton";

/**
 * Overpayment credits and refunds (F2 2.4, D-198): who holds a credit with the tenant, refund it (cash
 * or transfer with its slip); the latest receipts with their PDFs.
 */
export async function CreditsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.payments.credits");
  const { api, locale } = context;
  const [credits, receipts] = await Promise.all([
    unwrap(api.GET("/v1/owner/payer-credits", { params: { query: {} } })),
    section(unwrap(api.GET("/v1/owner/receipts", { params: { query: { perPage: 20 } } }))),
  ]);
  return (
    <OwnerPage testId="credits">
      <PageHeader title={t("title")} description={t("description")} />
      {/* The list pattern (G3 revision): credits to settle, then the latest receipts — tables with one action each. */}
      <section aria-labelledby="credit-list" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="credit-list" className="text-lg font-semibold">
            {t("credits")}
          </h2>
          <p className="text-muted text-sm">{t("creditsHint")}</p>
        </div>
        {credits.length ? (
          <SimpleTable
            caption={t("credits")}
            testId="credit-list"
            stackOnPhones
            minWidth="40rem"
            columns={[
              { key: "unit", header: t("col.unit"), phone: "meta" },
              { key: "party", header: t("col.party"), phone: "title" },
              { key: "balance", header: t("col.balance"), align: "end", phone: "figure" },
              {
                key: "action",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "status",
              },
            ]}
            rows={credits.map((credit) => ({
              key: `${credit.partyId}-${credit.unitId ?? ""}`,
              testId: "credit-row",
              cells: {
                unit: <span className="font-mono">{credit.unitNo ?? "—"}</span>,
                party: (
                  <a
                    className="underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/parties/${credit.partyId}`)}
                  >
                    {credit.partyName}
                  </a>
                ),
                balance: (
                  <span className="font-semibold tabular-nums" data-testid="credit-balance">
                    {formatTHB(credit.balance, locale)}
                  </span>
                ),
                action: <RefundButton credit={credit} />,
              },
            }))}
          />
        ) : (
          <Card>
            <EmptyState
              icon={IconWallet}
              title={t("empty")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/payments")}>{t("emptyAction")}</a>
                </Button>
              }
            />
          </Card>
        )}
      </section>
      <section aria-labelledby="receipt-list" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="receipt-list" className="text-lg font-semibold">
            {t("receipts")}
          </h2>
          <p className="text-muted text-sm">{t("receiptsHint")}</p>
        </div>
        {receipts.data && receipts.data.data.length ? (
          <SimpleTable
            caption={t("receipts")}
            testId="receipt-list"
            stackOnPhones
            minWidth="52rem"
            columns={[
              { key: "number", header: t("col.number"), phone: "title" },
              { key: "unit", header: t("col.unit"), phone: "meta" },
              { key: "payer", header: t("col.party"), phone: "meta" },
              { key: "issued", header: t("col.issued"), phone: "hidden" },
              { key: "amount", header: t("col.amount"), align: "end", phone: "figure" },
              {
                key: "menu",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "status",
              },
            ]}
            rows={receipts.data.data.map((receipt) => ({
              key: receipt.id,
              cells: {
                number: (
                  <span className="flex flex-col">
                    <span className="font-mono">{receipt.number}</span>
                    {receipt.voidedAt ? <span className="text-muted text-sm">{t("voided")}</span> : null}
                  </span>
                ),
                unit: <span className="font-mono">{receipt.unitNo ?? "—"}</span>,
                payer: receipt.payerName,
                issued: <span className="text-muted text-sm">{formatDateTime(receipt.issuedAt, locale)}</span>,
                amount: <span className="font-medium tabular-nums">{formatTHB(receipt.amount, locale)}</span>,
                menu: (
                  <ReceiptRowMenu
                    receipt={{
                      id: receipt.id,
                      number: receipt.number,
                      payerName: receipt.payerName,
                      hasDocument: receipt.hasDocument,
                      voided: Boolean(receipt.voidedAt),
                    }}
                  />
                ),
              },
            }))}
          />
        ) : (
          <p className="text-muted text-sm">{t("noReceipts")}</p>
        )}
      </section>
    </OwnerPage>
  );
}
