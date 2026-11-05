import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { formatDate, formatDateTime, formatIsoDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection } from "@/ui/components/Paper";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconLedger } from "@/ui/icons/glyphs/ledger";
import { IconUndo } from "@/ui/icons/glyphs/undo";

import { ownerPath } from "../../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { recentMonths } from "../collections/statement";
import { journalAccounts } from "./accounts";
import { ReverseJournalButton } from "./JournalActions";
import { JournalForm } from "./JournalForm";
import { isZero } from "./money";
import { AccountingNav, journalRef, journalSourceHref } from "./parts";
import { adoptedResolutions, chartOfAccounts } from "./shared";

type SearchParams = Record<string, string | string[] | undefined>;
type Source = Schemas["JuristicJournalSource"];

export const JOURNAL_SOURCES: readonly Source[] = [
  "invoice",
  "invoice_void",
  "credit_note",
  "debit_note",
  "payment",
  "payment_reversal",
  "refund",
  "revenue_recognition",
  "expense_payment",
  "petty_cash",
  "fund_transfer",
  "manual",
  "opening",
  "reversal",
];

/** The last day of a `YYYY-MM` month. */
function monthEnd(month: string): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/**
 * The journal (J2.1 §2): every posted entry, newest first — date, reference, where it came from, the memo and its
 * total (Σ debit = Σ credit, the API's). Entries are immutable; a correction is a reversal, shown as such.
 */
export async function JournalsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.accounting.journals");
  const sources = await getTranslations("owner.accounting.source");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const page = pageParam(searchParams.page);
  const q = param(searchParams.q);
  const source = JOURNAL_SOURCES.find((value) => value === param(searchParams.source));
  const month = /^\d{4}-\d{2}$/.test(param(searchParams.month) ?? "") ? param(searchParams.month)! : undefined;
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/journals", {
        params: {
          query: {
            page,
            perPage: 30,
            ...(q ? { q } : {}),
            ...(source ? { sourceType: source } : {}),
            ...(month ? { from: `${month}-01`, to: monthEnd(month) } : {}),
            ...(building ? { buildingId: building.id } : {}),
          },
        },
      }),
    ),
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.accounting.manage");
  const base = ownerPath(locale, "/juristic/accounting/journals");
  const filtered = Boolean(q || source || month);
  const rows = list.data?.data ?? [];
  return (
    <OwnerPage testId="juristic-journals">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage ? (
            <Button asChild variant="primary" iconStart={IconAdd} data-testid="journal-new">
              <a href={ownerPath(locale, "/juristic/accounting/journals/new")}>{t("new")}</a>
            </Button>
          ) : undefined
        }
      />
      <AccountingNav current="journals" locale={locale} />
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
              {
                name: "source",
                label: t("source"),
                type: "select",
                placeholder: t("allSources"),
                options: JOURNAL_SOURCES.map((value) => ({ value, label: sources(value) })),
              },
              {
                name: "month",
                label: t("month"),
                type: "period",
                periods: recentMonths(formatIsoDate(currentTime()), 24),
                allLabel: t("allMonths"),
              },
            ]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconLedger}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filtered") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? base : ownerPath(locale, "/juristic/accounting")}>
                {filtered ? t("empty.clear") : t("empty.toStatements")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="journal-rows"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "date", header: t("col.date"), phone: "meta" },
            { key: "ref", header: t("col.ref"), phone: "hidden" },
            { key: "memo", header: t("col.memo"), phone: "title" },
            { key: "source", header: t("col.source"), phone: "status" },
            { key: "total", header: t("col.total"), align: "end", phone: "figure" },
          ]}
          rows={rows.map((journal) => ({
            key: journal.id,
            href: ownerPath(locale, `/juristic/accounting/journals/${journal.id}`),
            testId: "journal-row",
            data: { source: journal.sourceType },
            cells: {
              date: <span className="whitespace-nowrap tabular-nums">{formatDate(journal.postedOn, locale)}</span>,
              ref: <span className="text-muted font-mono text-sm whitespace-nowrap">{journalRef(journal)}</span>,
              memo: (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{journal.memo}</span>
                  {building ? null : <span className="text-muted text-sm">{journal.buildingName}</span>}
                </span>
              ),
              source: (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="text-sm">{sources(journal.sourceType)}</span>
                  {journal.reversedByJournalId ? (
                    <Badge size="sm" tone="neutral" icon={IconUndo}>
                      {t("reversed")}
                    </Badge>
                  ) : null}
                </span>
              ),
              total: <span className="font-medium tabular-nums">{formatTHB(journal.total, locale)}</span>,
            },
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
 * One journal as paper: date, where it came from (a link to the document when the console has a page for it), the
 * memo, the lines with their debits and credits and the totals on a double rule. Reversal is offered only for manual
 * and opening entries — documents correct their own journals.
 */
export async function JournalView({ context, journalId }: { context: OwnerContext; journalId: string }) {
  const t = await getTranslations("owner.accounting.journals");
  const sources = await getTranslations("owner.accounting.source");
  const { api, locale, me } = context;
  let journal: Schemas["JournalDto"];
  try {
    journal = await unwrap(api.GET("/v1/owner/juristic/journals/{journalId}", { params: { path: { journalId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const money = (value: string) => (isZero(value) ? "" : formatTHB(value, locale, { withSymbol: false }));
  const sourceHref = journalSourceHref(journal);
  const reversible = journal.sourceType === "manual" || journal.sourceType === "opening";
  const canReverse =
    !readOnly(me) && ownerCan(me, "juristic.accounting.manage") && reversible && !journal.reversedByJournalId;
  const resolution = journal.resolutionId
    ? await section(
        unwrap(
          api.GET("/v1/owner/juristic/resolutions/{resolutionId}", {
            params: { path: { resolutionId: journal.resolutionId } },
          }),
        ),
      )
    : null;
  return (
    <OwnerPage testId="juristic-journal">
      <PageHeader
        title={t("recordTitle", { ref: journalRef(journal) })}
        description={journal.memo}
        status={
          journal.reversedByJournalId ? (
            <Badge tone="neutral" icon={IconUndo}>
              {t("reversed")}
            </Badge>
          ) : undefined
        }
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/accounting/journals") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="journal-panel"
            title={t("panelTitle")}
            description={
              journal.reversedByJournalId
                ? t("panelReversed")
                : reversible
                  ? t("panelReversible")
                  : t("panelDocument", { source: sources(journal.sourceType) })
            }
            facts={[
              { key: "source", label: t("col.source"), value: sources(journal.sourceType) },
              { key: "posted", label: t("col.date"), value: formatDate(journal.postedOn, locale) },
              { key: "created", label: t("createdAt"), value: formatDateTime(journal.createdAt, locale) },
              { key: "total", label: t("col.total"), value: formatTHB(journal.total, locale) },
            ]}
            primary={
              canReverse ? <ReverseJournalButton journal={journal} today={formatIsoDate(currentTime())} /> : undefined
            }
            secondary={
              <>
                {sourceHref ? (
                  <Button asChild variant="secondary" block>
                    <a href={ownerPath(locale, sourceHref)} data-testid="journal-source">
                      {journal.sourceType === "reversal" ? t("openReversed") : t("openSource")}
                    </a>
                  </Button>
                ) : null}
                {journal.reversedByJournalId ? (
                  <Button asChild variant="secondary" block>
                    <a
                      href={ownerPath(locale, `/juristic/accounting/journals/${journal.reversedByJournalId}`)}
                      data-testid="journal-reversal"
                    >
                      {t("openReversal")}
                    </a>
                  </Button>
                ) : null}
              </>
            }
          />
        }
      >
        <Paper label={t("recordTitle", { ref: journalRef(journal) })} testId="journal-paper">
          <PaperHead
            kind={t("paperKind")}
            number={journalRef(journal)}
            facts={[
              { key: "date", label: t("col.date"), value: formatDate(journal.postedOn, locale) },
              { key: "source", label: t("col.source"), value: sources(journal.sourceType) },
            ]}
          />
          <PaperParties
            items={[
              { key: "building", label: t("building"), value: journal.buildingName },
              { key: "memo", label: t("col.memo"), value: journal.memo },
              ...(resolution?.data
                ? [
                    {
                      key: "resolution",
                      label: t("resolution"),
                      value: (
                        <a
                          className="text-primary underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/juristic/resolutions/${resolution.data.id}`)}
                        >
                          {t("resolutionValue", { number: resolution.data.number, title: resolution.data.title })}
                        </a>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <PaperSection title={t("lines")}>
            <SimpleTable
              caption={t("lines")}
              minWidth="40rem"
              testId="journal-lines"
              columns={[
                { key: "account", header: t("col.account") },
                { key: "detail", header: t("col.detail") },
                { key: "debit", header: t("col.debit"), align: "end" },
                { key: "credit", header: t("col.credit"), align: "end" },
              ]}
              rows={journal.lines.map((line) => ({
                key: String(line.lineNo),
                testId: "journal-line",
                cells: {
                  account: (
                    <span className="flex items-baseline gap-2">
                      <span className="text-muted font-mono text-sm">{line.accountCode}</span>
                      <span>{line.accountName}</span>
                    </span>
                  ),
                  detail: (
                    <span className="text-muted text-sm">
                      {[line.unitNo, line.partyName, line.memo].filter(Boolean).join(" · ") || "—"}
                    </span>
                  ),
                  debit: <span className="tabular-nums">{money(line.debit)}</span>,
                  credit: <span className="tabular-nums">{money(line.credit)}</span>,
                },
              }))}
              footer={{
                account: t("total"),
                debit: (
                  <span className="border-fg block border-b-[3px] border-double">
                    {formatTHB(journal.total, locale, { withSymbol: false })}
                  </span>
                ),
                credit: (
                  <span className="border-fg block border-b-[3px] border-double">
                    {formatTHB(journal.total, locale, { withSymbol: false })}
                  </span>
                ),
              }}
            />
          </PaperSection>
          <PaperFoot>
            <span>{t("immutable")}</span>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}

/** The manual journal form (owner / manager / accountant): the buildings, the active accounts and adopted resolutions. */
export async function JournalNewView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.accounting.journalForm");
  const { api, locale, me } = context;
  const [accounts, resolutions] = await Promise.all([
    chartOfAccounts(api),
    adoptedResolutions(api, (row) => t("resolutionOption", { number: row.number, title: row.title })),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.accounting.manage");
  return (
    <OwnerPage testId="juristic-journal-new">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        back={{ label: t("back"), href: ownerPath(locale, "/juristic/accounting/journals") }}
      />
      {!canManage ? (
        <EmptyState
          variant="card"
          icon={IconLedger}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/juristic/accounting/journals")}>{t("back")}</a>
            </Button>
          }
        />
      ) : (
        <JournalForm
          buildings={context.buildings.map((building) => ({ id: building.id, name: building.name }))}
          accounts={journalAccounts(accounts)}
          resolutions={resolutions}
          defaultBuildingId={focusedBuilding(context)?.id}
          today={formatIsoDate(currentTime())}
        />
      )}
    </OwnerPage>
  );
}
