import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { INVOICE_STATUS } from "@/domain/status/invoice";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";

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
        actions={
          <a
            className="text-sm underline-offset-4 hover:underline"
            href={ownerPath(locale, withQuery("/payments/new", { party: partyId }))}
          >
            {t("recordPayment")}
          </a>
        }
      />
      <Card as="section" aria-labelledby="open-invoices" data-testid="party-open-invoices">
        <CardHeader
          title={<span id="open-invoices">{t("openInvoices")}</span>}
          description={credit ? t("credit", { amount: formatTHB(credit.balance, locale) }) : undefined}
        />
        {invoices.length ? (
          <ul className="divide-border flex flex-col divide-y">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center gap-3 py-3" data-testid="party-invoice">
                <a
                  className="w-40 font-mono underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/invoices/${invoice.id}`)}
                >
                  {invoice.number ?? "—"}
                </a>
                <span className="w-16 font-mono">{invoice.unitNo ?? "—"}</span>
                <span className="text-muted flex-1 text-sm">
                  {invoice.dueDate ? t("due", { date: formatDate(invoice.dueDate, locale) }) : ""}
                </span>
                <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />
                <span className="tabular-nums">{formatTHB(invoice.balance, locale)}</span>
                <RemindButton
                  invoiceId={invoice.id}
                  label={invoice.number ?? invoice.unitNo ?? ""}
                  balance={formatTHB(invoice.balance, locale)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t("noOpen")}</p>
        )}
      </Card>
      <Card as="section" aria-labelledby="ledger" data-testid="party-ledger">
        <CardHeader title={<span id="ledger">{t("ledger")}</span>} description={t("ledgerHint")} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">{t("ledger")}</caption>
            <thead>
              <tr className="border-border text-muted border-b">
                <th scope="col" className="py-2 text-start font-medium">
                  {t("col.date")}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {t("col.entry")}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {t("col.unit")}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t("col.amount")}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t("col.balance")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.data.map((entry) => {
                const link = href(entry.refType, entry.refId);
                return (
                  <tr
                    key={entry.id}
                    className="border-border border-b"
                    data-testid="ledger-row"
                    data-type={entry.entryType}
                  >
                    <td className="py-2">{formatDateTime(entry.occurredAt, locale)}</td>
                    <th scope="row" className="py-2 text-start font-normal">
                      {link ? (
                        <a className="underline-offset-4 hover:underline" href={link}>
                          {entryT(entry.entryType)}
                        </a>
                      ) : (
                        entryT(entry.entryType)
                      )}
                    </th>
                    <td className="py-2 font-mono">{entry.unitNo ?? "—"}</td>
                    <td className="py-2 text-end tabular-nums">{formatTHB(entry.amount, locale)}</td>
                    <td className="py-2 text-end tabular-nums">{formatTHB(entry.runningBalance, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ListPagination
          meta={entries.meta}
          path={ownerPath(locale, `/arrears/${partyId}`)}
          searchParams={searchParams}
          locale={locale}
        />
      </Card>
    </OwnerPage>
  );
}
