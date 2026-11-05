import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BANK_LINE_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { ProgressLine } from "@/ui/components/ProgressLine";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconSpreadsheet } from "@/ui/icons/glyphs/spreadsheet";
import { cn } from "@/ui/lib/cn";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { IgnoreButton, ImportStatementButton, MatchButton, UnmatchButton } from "./BankActions";
import {
  direction,
  lineState,
  nextLineAfter,
  queueOrder,
  queueProgress,
  rankSuggestions,
  selectLine,
  type LineState,
} from "./matching";
import { unsigned } from "./money";

type SearchParams = Record<string, string | string[] | undefined>;

/** "฿12,000.00" in, "−฿1,500.00" out — the sign is the API's; the word says the direction for screen readers. */
function SignedAmount({
  amount,
  locale,
  labels,
}: {
  amount: string;
  locale: Locale;
  labels: { in: string; out: string };
}) {
  const out = direction(amount) === "out";
  return (
    <span className="font-medium whitespace-nowrap tabular-nums">
      <span className="sr-only">{out ? labels.out : labels.in} </span>
      {out ? "−" : "+"}
      {formatTHB(unsigned(amount), locale)}
    </span>
  );
}

/**
 * Bank statements (J2.1 §7): the files imported per bank account, each with how far its lines are matched; import a
 * new file. Matching itself happens on the statement's queue.
 */
export async function BankStatementsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.accounting.bank");
  const { api, locale, me } = context;
  const page = pageParam(searchParams.page);
  const [list, banks] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/juristic/bank-statements", { params: { query: { page, perPage: 25 } } }))),
    unwrap(api.GET("/v1/owner/bank-accounts")).catch(() => [] as Schemas["BankAccountDto"][]),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.accounting.manage");
  const bankOptions = banks.map((bank) => ({ id: bank.id, label: `${bank.bankNameTh} ${bank.accountNoMasked}` }));
  const base = ownerPath(locale, "/juristic/bank-statements");
  return (
    <OwnerPage testId="juristic-bank-statements">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={canManage && bankOptions.length ? <ImportStatementButton banks={bankOptions} /> : undefined}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconSpreadsheet}
          title={t("empty.title")}
          description={bankOptions.length ? t("empty.body") : t("empty.noBank")}
          action={canManage && bankOptions.length ? <ImportStatementButton banks={bankOptions} /> : undefined}
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="bank-statement-rows"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "file", header: t("col.file"), phone: "title" },
            { key: "period", header: t("col.period"), phone: "meta" },
            { key: "lines", header: t("col.lines"), align: "end", phone: "hidden" },
            { key: "progress", header: t("col.progress"), phone: "status" },
          ]}
          rows={list.data.data.map((statement) => {
            const progress = queueProgress(statement);
            return {
              key: statement.id,
              href: ownerPath(locale, `/juristic/bank-statements/${statement.id}`),
              testId: "bank-statement-row",
              cells: {
                file: (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {statement.bankName} {statement.bankAccountMasked}
                    </span>
                    <span className="text-muted truncate text-sm">
                      {statement.fileName} · {t(`formats.${statement.formatKey}`)}
                    </span>
                  </span>
                ),
                period: (
                  <span className="flex flex-col text-sm">
                    <span>
                      {statement.periodStart && statement.periodEnd
                        ? `${formatDate(statement.periodStart, locale)} – ${formatDate(statement.periodEnd, locale)}`
                        : "—"}
                    </span>
                    <span className="text-muted">
                      {t("importedAt", { date: formatDateTime(statement.importedAt, locale) })}
                    </span>
                  </span>
                ),
                lines: (
                  <span className="flex flex-col items-end text-sm tabular-nums">
                    <span>{t("lines", { count: statement.lineCount })}</span>
                    {statement.duplicateCount ? (
                      <span className="text-muted">{t("duplicates", { count: statement.duplicateCount })}</span>
                    ) : null}
                  </span>
                ),
                progress:
                  progress.unmatched === 0 ? (
                    <StatusText tone="success" icon={IconCheckCircle}>
                      {t("done")}
                    </StatusText>
                  ) : (
                    <span className="flex w-40 flex-col gap-1">
                      <span className="text-sm tabular-nums">
                        {t("progress", { done: progress.done, total: progress.total })}
                      </span>
                      <ProgressLine
                        share={progress.share}
                        label={t("progress", { done: progress.done, total: progress.total })}
                      />
                    </span>
                  ),
              },
            };
          })}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

const STATES: readonly LineState[] = ["unmatched", "matched", "ignored"];

/**
 * The matching queue of one statement (J2.1 §7) — two panes: the statement's lines on the left (state tabs with
 * counts, date, money in / out, the bank's text and reference), the selected line's candidates on the right as the API
 * ranks them (a reference found in the bank text first, then the closest date), match / ignore / unmatch. After an
 * action the next open line is selected, so the office works down the file. Progress: "จับคู่แล้ว 18 จาก 24".
 */
export async function BankQueueView({
  context,
  statementId,
  searchParams,
}: {
  context: OwnerContext;
  statementId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.accounting.bankQueue");
  const banks = await getTranslations("owner.accounting.bank");
  const { api, locale, me } = context;
  let statement: Schemas["BankStatementDto"];
  try {
    statement = await unwrap(
      api.GET("/v1/owner/juristic/bank-statements/{statementId}", { params: { path: { statementId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const lines = await section(
    unwrap(
      api.GET("/v1/owner/juristic/bank-statement-lines", {
        params: { query: { statementId, state: "all", perPage: 100 } },
      }),
    ),
  );
  const all = queueOrder(lines.data?.data ?? []);
  const state = STATES.find((value) => value === param(searchParams.state)) ?? "unmatched";
  const shown = all.filter((line) => lineState(line) === state);
  const selected = selectLine(shown, param(searchParams.line));
  const detail = selected
    ? await section(
        unwrap(
          api.GET("/v1/owner/juristic/bank-statement-lines/{lineId}", { params: { path: { lineId: selected.id } } }),
        ),
      )
    : null;
  const progress = queueProgress(statement);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.accounting.manage");
  const base = ownerPath(locale, `/juristic/bank-statements/${statement.id}`);
  const next = selected ? (nextLineAfter(all, selected.id)?.id ?? null) : null;
  const count = (value: LineState) => all.filter((line) => lineState(line) === value).length;
  const directionLabels = { in: t("in"), out: t("out") };
  return (
    <OwnerPage testId="juristic-bank-queue">
      <PageHeader
        title={t("title", { bank: statement.bankName, account: statement.bankAccountMasked })}
        description={t("lede", {
          file: statement.fileName,
          from: statement.periodStart ? formatDate(statement.periodStart, locale) : "—",
          to: statement.periodEnd ? formatDate(statement.periodEnd, locale) : "—",
        })}
        back={{ label: banks("title"), href: ownerPath(locale, "/juristic/bank-statements") }}
      />
      <Card className="flex flex-col gap-2" data-testid="queue-progress">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-semibold">{t("progress", { done: progress.done, total: progress.total })}</span>
          <span className="text-muted text-sm">
            {t("breakdown", { matched: progress.matched, ignored: progress.ignored, unmatched: progress.unmatched })}
          </span>
        </div>
        <ProgressLine share={progress.share} label={t("progress", { done: progress.done, total: progress.total })} />
      </Card>
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("states")}
            current={state}
            tabs={STATES.map((value) => ({
              key: value,
              href: withQuery(base, { state: value === "unmatched" ? undefined : value }),
              label: t(`state.${value}`),
              count: count(value),
              testId: `queue-tab-${value}`,
            }))}
          />
        }
      />
      {!lines.data ? (
        <SectionError error={lines.error} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <section
            aria-labelledby="queue-lines"
            className={cn("flex flex-col gap-3", selected && param(searchParams.line) && "max-lg:order-2")}
          >
            <h2 id="queue-lines" className="sr-only">
              {t("lines")}
            </h2>
            {shown.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconCheckCircle}
                title={t(`empty.${state}.title`)}
                description={t(`empty.${state}.body`)}
                action={
                  <Button asChild variant="secondary">
                    <a href={ownerPath(locale, "/juristic/bank-statements")}>{t("toFiles")}</a>
                  </Button>
                }
              />
            ) : (
              <ol
                className="border-border bg-surface rounded-card shadow-card m-0 list-none divide-y border p-0"
                data-testid="queue-lines"
              >
                {shown.map((line) => {
                  const current = line.id === selected?.id;
                  return (
                    <li key={line.id} className="divide-border">
                      <a
                        href={withQuery(base, { state: state === "unmatched" ? undefined : state, line: line.id })}
                        aria-current={current ? "true" : undefined}
                        data-testid="queue-line"
                        data-state={lineState(line)}
                        className={cn(
                          "grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 px-4 py-3 md:grid-cols-[5.5rem_minmax(0,1fr)_auto] md:gap-x-4",
                          current ? "bg-primary-subtle" : "hover:bg-bg-subtle",
                        )}
                      >
                        <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                          {formatDate(line.bookedOn, locale, { style: "dayMonth" })}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className={cn("line-clamp-2", current && "text-primary-subtle-fg font-medium")}>
                            {line.description}
                          </span>
                          <span className="text-muted truncate text-sm">
                            {line.reference ? <span className="font-mono">{line.reference}</span> : t("noReference")}
                            {line.ignoreReason ? ` · ${line.ignoreReason}` : null}
                          </span>
                        </span>
                        <SignedAmount amount={line.amount} locale={locale} labels={directionLabels} />
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <aside
            aria-labelledby="queue-detail"
            className={cn("lg:sticky lg:top-6", param(searchParams.line) ? "max-lg:order-1" : "")}
            data-testid="queue-detail"
          >
            {!selected || !detail ? null : !detail.data ? (
              <SectionError error={detail.error} />
            ) : (
              <LineDetail
                line={detail.data}
                locale={locale}
                canManage={canManage}
                base={base}
                state={state === "unmatched" ? undefined : state}
                next={next}
                labels={directionLabels}
              />
            )}
          </aside>
        </div>
      )}
    </OwnerPage>
  );
}

async function LineDetail({
  line,
  locale,
  canManage,
  base,
  state,
  next,
  labels,
}: {
  line: Schemas["BankStatementLineDetailDto"];
  locale: Locale;
  canManage: boolean;
  base: string;
  state?: string;
  next: string | null;
  labels: { in: string; out: string };
}) {
  const t = await getTranslations("owner.accounting.bankQueue");
  const open = line.matchKind === "none";
  const ranked = rankSuggestions(line.suggestions);
  return (
    <Card as="section" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 id="queue-detail" className="text-base font-semibold">
            {t("line", { n: line.lineNo })}
          </h2>
          <StatusBadgeOf map={BANK_LINE_STATUS} value={line.matchKind} size="sm" />
        </div>
        <p className="m-0 text-2xl font-semibold tracking-tight">
          <SignedAmount amount={line.amount} locale={locale} labels={labels} />
        </p>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("date")}</dt>
          <dd className="m-0">{formatDate(line.bookedOn, locale)}</dd>
          <dt className="text-muted">{t("text")}</dt>
          <dd className="m-0 break-words">{line.description}</dd>
          <dt className="text-muted">{t("reference")}</dt>
          <dd className="m-0 font-mono">{line.reference ?? "—"}</dd>
          {line.balance ? (
            <>
              <dt className="text-muted">{t("balanceAfter")}</dt>
              <dd className="m-0 tabular-nums">{formatTHB(line.balance, locale)}</dd>
            </>
          ) : null}
        </dl>
      </header>
      {open ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t("candidates")}</h3>
          {ranked.list.length === 0 ? (
            <p className="text-muted m-0 text-sm" data-testid="queue-no-candidates">
              {t("noCandidates")}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="queue-candidates">
              {ranked.list.map((suggestion) => {
                const best = ranked.best?.id === suggestion.id;
                return (
                  <li
                    key={`${suggestion.kind}-${suggestion.id}`}
                    className={cn(
                      "rounded-control flex flex-col gap-2 border p-3",
                      best ? "border-primary bg-primary-subtle/40" : "border-border",
                    )}
                    data-testid="queue-candidate"
                    data-best={best}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium break-words">{suggestion.label}</span>
                        <span className="text-muted text-sm">
                          {t(`kind.${suggestion.kind}`)} · {formatDate(suggestion.bookedOn, locale)} ·{" "}
                          {suggestion.days === 0 ? t("sameDay") : t("days", { count: suggestion.days })}
                        </span>
                      </span>
                      <span className="text-sm whitespace-nowrap tabular-nums">
                        {formatTHB(unsigned(suggestion.amount), locale)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {suggestion.referenceHit ? (
                        <Badge size="sm" tone="success">
                          {t("referenceHit")}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      {canManage ? (
                        <MatchButton
                          line={line}
                          suggestion={suggestion}
                          base={base}
                          state={state}
                          next={next}
                          best={best}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {canManage ? (
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <span className="text-muted text-sm">{t("ignoreHint")}</span>
              <IgnoreButton line={line} base={base} state={state} next={next} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm">
            {line.matchKind === "ignored"
              ? t("ignoredBecause", { reason: line.ignoreReason ?? "—" })
              : t(line.matchMethod === "auto" ? "matchedAuto" : "matchedManual", {
                  date: line.matchedAt ? formatDateTime(line.matchedAt, locale) : "—",
                })}
          </p>
          {canManage ? (
            <div>
              <UnmatchButton line={line} />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
