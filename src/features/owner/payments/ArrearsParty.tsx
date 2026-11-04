import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { INVOICE_STATUS } from "@/domain/status/invoice";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath, withQuery } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { pageParam, param, section, type OwnerContext } from "../shared/server";
import { RemindButton } from "./RemindButton";

type SearchParams = Record<string, string | string[] | undefined>;
const OPEN: Schemas["InvoiceStatus"][] = ["overdue", "partially_paid", "issued"];

/**
 * One party's arrears (F2 2.4): the open invoices with "send reminder now", the ledger (invoices,
 * payments, notes, refunds with the API's running balance) and any credit held.
 */
export async function ArrearsParty({
  context,
  partyId,
  searchParams,
}: {
  context: OwnerContext;
  partyId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.arrears.party");
  const entryT = await getTranslations("owner.arrears.entry");
  const { api, locale } = context;
  const unitId = param(searchParams.unit);
  let party: Schemas["PartyDto"];
  try {
    party = await unwrap(api.GET("/v1/owner/parties/{partyId}", { params: { path: { partyId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [entries, invoices, credits] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/receivables/entries", {
        params: { query: { partyId, unitId, page: pageParam(searchParams.page), perPage: 25 } },
      }),
    ),
    Promise.all(
      OPEN.map((status) =>
        unwrap(api.GET("/v1/owner/invoices", { params: { query: { partyId, unitId, status, perPage: 50 } } }))
          .then((page) => page.data)
          .catch(() => []),
      ),
    ).then((lists) => lists.flat()),
    section(unwrap(api.GET("/v1/owner/payer-credits", { params: { query: { partyId } } }))),
  ]);
  const credit = (credits.data ?? []).find((candidate) => !unitId || candidate.unitId === unitId);
  const href = (refType: string, refId: string) =>
    refType === "invoice"
      ? ownerPath(locale, `/invoices/${refId}`)
      : refType === "payment"
        ? ownerPath(locale, `/payments/${refId}`)
        : null;

  return (
    <OwnerPage testId="arrears-party">
      <PageHeader
        title={party.displayName}
        testId="arrears-party-title"
        description={t("description")}
        crumbs={[{ label: party.displayName }]}
      />
      {/* The record pattern (G3 revision): the open invoices and the account statement on the left, the next steps —
          record a payment — in the panel. Payments read as accounting, in brackets; balances are the API's. */}
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            testId="arrears-party-panel"
            facts={[
              { key: "open", label: t("factOpen"), value: invoices.length },
              ...(credit ? [{ key: "credit", label: t("factCredit"), value: formatTHB(credit.balance, locale) }] : []),
            ]}
            primary={
              <Button asChild>
                <a href={ownerPath(locale, withQuery("/payments/new", { party: partyId }))}>{t("recordPayment")}</a>
              </Button>
            }
            secondary={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, `/parties/${partyId}`)}>{t("openParty")}</a>
              </Button>
            }
          />
        }
      >
        <section aria-labelledby="open-invoices" className="flex flex-col gap-3" data-testid="party-open-invoices">
          <h2 id="open-invoices" className="text-lg font-semibold">
            {t("openInvoices")}
          </h2>
          {invoices.length ? (
            <SimpleTable
              caption={t("openInvoices")}
              stackOnPhones
              minWidth="44rem"
              columns={[
                { key: "number", header: t("col.number"), phone: "title" },
                { key: "unit", header: t("col.unit"), phone: "meta" },
                { key: "due", header: t("col.due"), phone: "meta" },
                { key: "status", header: t("col.status"), phone: "status" },
                { key: "balance", header: t("col.owed"), align: "end", phone: "figure" },
                {
                  key: "action",
                  header: <span className="sr-only">{t("col.action")}</span>,
                  align: "end",
                  phone: "hidden",
                },
              ]}
              rows={invoices.map((invoice) => ({
                key: invoice.id,
                testId: "party-invoice",
                cells: {
                  number: (
                    <a
                      className="text-primary font-mono underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/invoices/${invoice.id}`)}
                    >
                      {invoice.number ?? "—"}
                    </a>
                  ),
                  unit: <span className="font-mono">{invoice.unitNo ?? "—"}</span>,
                  due: invoice.dueDate ? (
                    <span className="text-muted text-sm">{formatDate(invoice.dueDate, locale)}</span>
                  ) : null,
                  status: <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />,
                  balance: <span className="font-medium tabular-nums">{formatTHB(invoice.balance, locale)}</span>,
                  action: (
                    <RemindButton
                      invoiceId={invoice.id}
                      label={invoice.number ?? invoice.unitNo ?? ""}
                      balance={formatTHB(invoice.balance, locale)}
                    />
                  ),
                },
              }))}
            />
          ) : (
            <p className="text-muted text-sm">{t("noOpen")}</p>
          )}
        </section>
        <section aria-labelledby="ledger" className="flex flex-col gap-3" data-testid="party-ledger">
          <div className="flex flex-col gap-0.5">
            <h2 id="ledger" className="text-lg font-semibold">
              {t("ledger")}
            </h2>
            <p className="text-muted text-sm">{t("ledgerHint")}</p>
          </div>
          <SimpleTable
            caption={t("ledger")}
            minWidth="36rem"
            columns={[
              { key: "entry", header: t("col.entry") },
              { key: "date", header: t("col.date") },
              { key: "unit", header: t("col.unit") },
              { key: "amount", header: t("col.amount"), align: "end" },
              { key: "balance", header: t("col.balance"), align: "end" },
            ]}
            rows={entries.data.map((entry) => {
              const link = href(entry.refType, entry.refId);
              const negative = entry.amount.startsWith("-");
              return {
                key: entry.id,
                testId: "ledger-row",
                data: { type: entry.entryType },
                cells: {
                  entry: link ? (
                    <a className="underline-offset-4 hover:underline" href={link}>
                      {entryT(entry.entryType)}
                    </a>
                  ) : (
                    entryT(entry.entryType)
                  ),
                  date: <span className="text-muted text-sm">{formatDateTime(entry.occurredAt, locale)}</span>,
                  unit: <span className="font-mono">{entry.unitNo ?? "—"}</span>,
                  amount: (
                    <span className="tabular-nums">
                      {negative
                        ? t("negative", { amount: formatTHB(entry.amount.slice(1), locale) })
                        : formatTHB(entry.amount, locale)}
                    </span>
                  ),
                  balance: <span className="font-medium tabular-nums">{formatTHB(entry.runningBalance, locale)}</span>,
                },
              };
            })}
          />
          <ListPagination
            meta={entries.meta}
            path={ownerPath(locale, `/arrears/${partyId}`)}
            searchParams={searchParams}
            locale={locale}
          />
        </section>
      </DetailLayout>
    </OwnerPage>
  );
}
