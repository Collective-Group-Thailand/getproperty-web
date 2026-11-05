import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LETTER_BATCH_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatIsoDate, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection, PaperTotals } from "@/ui/components/Paper";
import { RowList } from "@/ui/components/RowList";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement } from "@/ui/components/Statement";
import { IconLetter } from "@/ui/icons/glyphs/letter";
import { IconPrinter } from "@/ui/icons/glyphs/printer";

import { DocumentButton } from "../../shared/DocumentButton";
import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { ChannelIcons } from "./parts";
import { groupByUnit, recentMonths } from "./statement";
import { IssueStatementsButton, NewLetterBatchButton, StatementPayButton } from "./StatementActions";

type SearchParams = Record<string, string | string[] | undefined>;

async function StatementsNav({
  current,
  locale,
}: {
  current: "statements" | "letters";
  locale: OwnerContext["locale"];
}) {
  const t = await getTranslations("owner.collections.nav");
  const href = {
    statements: ownerPath(locale, "/juristic/statements"),
    letters: ownerPath(locale, "/juristic/statements/letters"),
  };
  return (
    <LinkTabs
      label={t("statements")}
      current={href[current]}
      tabs={[
        { href: href.statements, label: t("statements"), testId: "statements-tab-statements" },
        { href: href.letters, label: t("letters"), testId: "statements-tab-letters" },
      ]}
    />
  );
}

/**
 * Owner statements (JW1b, D-307): one per owner and month across all their units — opening, charges, credits,
 * payments, closing and what is due now. Issued for a month in one go (owners already stated are skipped); each is
 * sent on LINE / e-mail, or printed for owners without a channel.
 */
export async function StatementsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.collections.statements");
  const { api, locale, me } = context;
  const period = param(searchParams.period);
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/statements");
  const months = recentMonths(formatIsoDate(currentTime()));
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/statements", {
        params: { query: { page, perPage: 25, ...(period ? { period } : {}), ...(q ? { q } : {}) } },
      }),
    ),
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const rows = list.data?.data ?? [];
  const filtered = Boolean(period || q);
  return (
    <OwnerPage testId="juristic-statements">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage ? (
            <IssueStatementsButton
              months={months}
              buildings={context.buildings.map((building) => ({ id: building.id, name: building.name }))}
            />
          ) : undefined
        }
      />
      <StatementsNav current="statements" locale={locale} />
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
              { name: "period", label: t("period"), type: "period", periods: months, allLabel: t("allMonths") },
            ]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : (
        <RowList
          label={t("title")}
          testId="statement-rows"
          empty={
            <EmptyState
              variant="card"
              icon={IconLetter}
              title={filtered ? t("empty.filteredTitle") : t("empty.title")}
              description={filtered ? t("empty.filtered") : t("empty.body")}
              action={
                filtered ? (
                  <Button asChild variant="secondary">
                    <a href={base}>{t("empty.clear")}</a>
                  </Button>
                ) : undefined
              }
            />
          }
          items={rows.map((row) => ({
            key: row.id,
            href: ownerPath(locale, `/juristic/statements/${row.id}`),
            lead: <span className="font-mono">{row.number}</span>,
            title: row.partyName,
            meta: t("rowMeta", {
              period: formatPeriodKey(row.period, locale),
              units: row.units.map((unit) => unit.unitNo).join(", "),
            }),
            status: <ChannelIcons channels={row.deliveredVia} />,
            figure: <span className="font-semibold tabular-nums">{formatTHB(row.amountDue, locale)}</span>,
            testId: "statement-row",
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/**
 * One statement as paper (J-DESIGN §4 paper statement): the issuer and the owner, the month's movement as a statement
 * with the closing on a double rule, the open invoices grouped by unit, what is due now. The panel records a payment
 * over the statement's invoices and opens the PDF.
 */
export async function StatementView({ context, statementId }: { context: OwnerContext; statementId: string }) {
  const t = await getTranslations("owner.collections.statements");
  const { api, locale, me } = context;
  let statement: Schemas["StatementDto"];
  try {
    statement = await unwrap(
      api.GET("/v1/owner/juristic/statements/{statementId}", { params: { path: { statementId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const money = (value: string) => formatTHB(value, locale);
  const groups = groupByUnit(statement);
  const canPay = !readOnly(me) && ownerCan(me, "payment.record");
  const due = !/^0+(\.0+)?$/.test(statement.amountDue);
  const issuer = me.currentTenant?.displayName ?? "";

  return (
    <OwnerPage testId="juristic-statement">
      <PageHeader
        title={t("recordTitle", { number: statement.number })}
        description={t("recordLede", { owner: statement.partyName, period: formatPeriodKey(statement.period, locale) })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/statements") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="statement-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{t("dueNow")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="statement-due">
                  {money(statement.amountDue)}
                </span>
              </div>
            }
            title={t("panelTitle")}
            description={due ? t("panelDue") : t("panelSettled")}
            facts={[
              { key: "issued", label: t("issuedAt"), value: formatDateTime(statement.issuedAt, locale) },
              {
                key: "via",
                label: t("deliveredVia"),
                value: <ChannelIcons channels={statement.deliveredVia} className="justify-end" />,
              },
              {
                key: "payments",
                label: t("paymentsRecorded"),
                value: formatNumber(statement.paymentIds.length, locale),
              },
            ]}
            primary={
              canPay && due ? (
                <StatementPayButton statement={statement} today={formatIsoDate(currentTime())} />
              ) : undefined
            }
            secondary={
              <>
                <DocumentButton
                  document={{ kind: "juristicStatement", id: statement.id }}
                  label={t("pdf")}
                  title={t("recordTitle", { number: statement.number })}
                  size="md"
                  testId="statement-pdf"
                />
                {statement.letterBatchId ? (
                  <Button asChild variant="secondary" block iconStart={IconPrinter}>
                    <a href={ownerPath(locale, `/juristic/statements/letters/${statement.letterBatchId}`)}>
                      {t("letterBatch")}
                    </a>
                  </Button>
                ) : null}
              </>
            }
          />
        }
      >
        <Paper label={t("recordTitle", { number: statement.number })} testId="statement-paper">
          <PaperHead
            kind={t("paperKind")}
            number={statement.number}
            facts={[
              { key: "period", label: t("period"), value: formatPeriodKey(statement.period, locale) },
              {
                key: "range",
                label: t("covers"),
                value: `${formatDate(statement.periodStart, locale)} – ${formatDate(statement.periodEnd, locale)}`,
              },
              { key: "issued", label: t("issuedAt"), value: formatDate(statement.issuedAt, locale) },
            ]}
          />
          <PaperParties
            items={[
              { key: "issuer", label: t("issuer"), value: issuer },
              { key: "owner", label: t("owner"), value: statement.partyName },
              {
                key: "units",
                label: t("units", { count: statement.units.length }),
                value: statement.units.map((unit) => unit.unitNo).join(", "),
                detail: [...new Set(statement.units.map((unit) => unit.building))].join(" · "),
              },
            ]}
          />
          <PaperSection title={t("movement")}>
            <Statement
              caption={t("movement")}
              lines={[
                { key: "opening", label: t("opening"), value: money(statement.opening) },
                { key: "charges", label: t("charges"), value: money(statement.charges), level: 1 },
                { key: "credits", label: t("credits"), value: money(statement.credits), level: 1 },
                { key: "payments", label: t("payments"), value: money(statement.payments), level: 1 },
                { key: "closing", label: t("closing"), value: money(statement.closing), kind: "subtotal" },
              ]}
            />
          </PaperSection>
          <PaperSection title={t("openByUnit")}>
            <div className="flex flex-col gap-6" data-testid="statement-units">
              {groups.map((group) => (
                <section
                  key={group.key}
                  className="flex flex-col gap-2"
                  data-testid="statement-unit"
                  data-unit={group.unitNo ?? ""}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">
                      {group.unitNo ? <span className="font-mono">{group.unitNo}</span> : t("otherUnits")}
                      {group.building ? (
                        <span className="text-muted ms-2 text-sm font-normal">{group.building}</span>
                      ) : null}
                    </h3>
                    <Badge size="sm" tone="neutral">
                      {t("openCount", { count: group.invoices.length })}
                    </Badge>
                  </div>
                  {group.invoices.length === 0 ? (
                    <p className="text-muted m-0 text-sm">{t("nothingOpen")}</p>
                  ) : (
                    <SimpleTable
                      caption={t("openByUnit")}
                      minWidth="32rem"
                      stackOnPhones
                      columns={[
                        { key: "number", header: t("invoice"), phone: "title" },
                        { key: "period", header: t("invoicePeriod") },
                        { key: "due", header: t("invoiceDue") },
                        { key: "balance", header: t("balance"), align: "end", phone: "figure" },
                      ]}
                      rows={group.invoices.map((invoice) => ({
                        key: invoice.id,
                        href: ownerPath(locale, `/invoices/${invoice.id}`),
                        cells: {
                          number: <span className="font-mono whitespace-nowrap">{invoice.number ?? "—"}</span>,
                          period: `${formatDate(invoice.periodStart, locale, { style: "dayMonth" })} – ${formatDate(invoice.periodEnd, locale)}`,
                          due: invoice.dueDate ? formatDate(invoice.dueDate, locale) : "—",
                          balance: money(invoice.balance),
                        },
                      }))}
                    />
                  )}
                </section>
              ))}
            </div>
          </PaperSection>
          <PaperTotals testId="statement-totals">
            <Statement
              caption={t("dueNow")}
              lines={[{ key: "due", label: t("dueNow"), value: money(statement.amountDue), kind: "result" }]}
            />
          </PaperTotals>
          <PaperFoot>
            <span>{t("foot")}</span>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}

/** Printed letters (D-307): batches of the month's statements for owners without LINE, e-mail or phone. */
export async function LettersView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.collections.letters");
  const { api, locale, me } = context;
  const page = pageParam(searchParams.page);
  const list = await section(
    unwrap(api.GET("/v1/owner/juristic/letter-batches", { params: { query: { page, perPage: 25 } } })),
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const months = recentMonths(formatIsoDate(currentTime()));
  return (
    <OwnerPage testId="juristic-letters">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={canManage ? <NewLetterBatchButton months={months} /> : undefined}
      />
      <StatementsNav current="letters" locale={locale} />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : (
        <RowList
          label={t("title")}
          testId="letter-rows"
          empty={
            <EmptyState
              variant="card"
              icon={IconPrinter}
              title={t("empty.title")}
              description={t("empty.body")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/juristic/statements")}>{t("empty.action")}</a>
                </Button>
              }
            />
          }
          items={list.data.data.map((batch) => ({
            key: batch.id,
            href: ownerPath(locale, `/juristic/statements/letters/${batch.id}`),
            icon: IconPrinter,
            title: t("rowTitle", { period: formatPeriodKey(batch.period, locale) }),
            meta:
              batch.error ??
              t("rowMeta", { count: batch.statementIds.length, date: formatDateTime(batch.requestedAt, locale) }),
            status: <StatusBadgeOf map={LETTER_BATCH_STATUS} value={batch.state} size="sm" />,
            testId: "letter-row",
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination
          meta={list.data.meta}
          path={ownerPath(locale, "/juristic/statements/letters")}
          searchParams={searchParams}
          locale={locale}
        />
      ) : null}
    </OwnerPage>
  );
}

/**
 * One letter batch (print view): its state, the PDF to print (A4, the name and address placed for the window of a DL
 * envelope, one page per owner) and the statements it holds.
 */
export async function LetterBatchView({ context, batchId }: { context: OwnerContext; batchId: string }) {
  const t = await getTranslations("owner.collections.letters");
  const { api, locale } = context;
  let batch: Schemas["LetterBatchDto"];
  try {
    batch = await unwrap(
      api.GET("/v1/owner/juristic/letter-batches/{letterBatchId}", { params: { path: { letterBatchId: batchId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const statements = await section(
    unwrap(api.GET("/v1/owner/juristic/statements", { params: { query: { period: batch.period, perPage: 100 } } })),
  );
  const inBatch = (statements.data?.data ?? []).filter((statement) => batch.statementIds.includes(statement.id));
  return (
    <OwnerPage testId="juristic-letter-batch">
      <PageHeader
        title={t("rowTitle", { period: formatPeriodKey(batch.period, locale) })}
        status={<StatusBadgeOf map={LETTER_BATCH_STATUS} value={batch.state} />}
        description={t("batchLede", { count: batch.statementIds.length })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/statements/letters") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={t("printTitle")}
            status={<StatusBadgeOf map={LETTER_BATCH_STATUS} value={batch.state} size="sm" />}
            description={
              batch.state === "ready" ? t("printReady") : batch.state === "failed" ? batch.error : t("printQueued")
            }
            facts={[
              { key: "requested", label: t("requestedAt"), value: formatDateTime(batch.requestedAt, locale) },
              ...(batch.finishedAt
                ? [{ key: "finished", label: t("finishedAt"), value: formatDateTime(batch.finishedAt, locale) }]
                : []),
            ]}
            primary={
              batch.state === "ready" ? (
                <DocumentButton
                  document={{ kind: "letterBatch", id: batch.id }}
                  label={t("print")}
                  title={t("rowTitle", { period: formatPeriodKey(batch.period, locale) })}
                  variant="primary"
                  size="md"
                  testId="letters-print"
                />
              ) : undefined
            }
          />
        }
      >
        <Card as="section" aria-labelledby="batch-statements" className="flex flex-col gap-4">
          <CardHeader title={<span id="batch-statements">{t("statements")}</span>} description={t("statementsHint")} />
          {inBatch.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noStatements")}</p>
          ) : (
            <RowList
              label={t("statements")}
              items={inBatch.map((statement) => ({
                key: statement.id,
                href: ownerPath(locale, `/juristic/statements/${statement.id}`),
                lead: <span className="font-mono">{statement.number}</span>,
                title: statement.partyName,
                meta: statement.units.map((unit) => unit.unitNo).join(", "),
                figure: <span className="tabular-nums">{formatTHB(statement.amountDue, locale)}</span>,
              }))}
            />
          )}
        </Card>
        <p className="text-muted m-0 text-sm">
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={withQuery(ownerPath(locale, "/juristic/statements"), { period: batch.period })}
          >
            {t("allOfMonth")}
          </a>
        </p>
      </DetailLayout>
    </OwnerPage>
  );
}
