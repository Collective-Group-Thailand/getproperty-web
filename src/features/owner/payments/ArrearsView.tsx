import { getTranslations } from "next-intl/server";

import { messageKey } from "@/i18n/keys";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Badge } from "@/ui/components/Badge";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { decimalShare, isZeroDecimal } from "@/ui/lib/decimal";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";

import { ExportButton } from "../shared/ExportButton";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../shared/server";
import { SettingValue } from "../shared/SettingValue";

type SearchParams = Record<string, string | string[] | undefined>;
const BUCKETS: Schemas["AgingBucket"][] = ["current", "d1_30", "d31_60", "d61_90", "d90p"];
const SORTS: Schemas["ReceivableSort"][] = ["balance", "days_overdue", "unit"];
const POLICY_KEYS = ["reminders.schedule", "late_fee.enabled", "late_fee.amount", "payments.allow_partial"];

/**
 * Arrears (F2 2.4, D-199): the aging of what residents owe (current · 1–30 · 31–60 · 61–90 · 90+ days, the
 * API's figures), filters (bucket, minimum days overdue, search, sort), each party one click from its
 * ledger; the reminder schedule and late-fee policy in force (read-only here, changed in settings); export.
 */
export async function ArrearsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.arrears");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const bucket = param(searchParams.bucket);
  const sortBy = param(searchParams.sort);
  const minDays = Number(param(searchParams.minDays));
  // Views (Stitch revision): every row · overdue (1+ day) · not yet due (the "current" bucket). Counts are the API's
  // `meta.total` of the same query with perPage=1.
  const view = minDays >= 1 ? "overdue" : bucket === "current" ? "notDue" : "all";
  const countOf = (query: { bucket?: Schemas["AgingBucket"]; minDaysOverdue?: number }) =>
    unwrap(
      api.GET("/v1/owner/receivables", {
        params: { query: { perPage: 1, q: param(searchParams.q), buildingId: building?.id, ...query } },
      }),
    )
      .then((page) => page.meta.total)
      .catch(() => undefined);
  const [list, settings, countAll, countOverdue, countNotDue] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/receivables", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            buildingId: building?.id,
            bucket: BUCKETS.includes(bucket as Schemas["AgingBucket"]) ? (bucket as Schemas["AgingBucket"]) : undefined,
            sortBy: SORTS.includes(sortBy as Schemas["ReceivableSort"])
              ? (sortBy as Schemas["ReceivableSort"])
              : undefined,
            minDaysOverdue: Number.isInteger(minDays) && minDays > 0 ? minDays : undefined,
          },
        },
      }),
    ),
    section(unwrap(api.GET("/v1/owner/settings", { params: { query: { propertyId: building?.propertyId } } }))),
    countOf({}),
    countOf({ minDaysOverdue: 1 }),
    countOf({ bucket: "current" }),
  ]);
  const money = (value: string) =>
    isZeroDecimal(value) ? <span className="text-muted">—</span> : formatTHB(value, locale);
  const filtered = Boolean(param(searchParams.q) || bucket || (Number.isInteger(minDays) && minDays > 0));
  const policy = (settings.data ?? []).filter((setting) => POLICY_KEYS.includes(setting.key));

  return (
    <OwnerPage testId="arrears">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <ExportButton
            kind="arrears_xlsx"
            params={{ buildingId: building?.id }}
            label={t("export")}
            testId="arrears-export"
          />
        }
      />
      {/* The aging strip: the total as the key cell, each bucket with a thin share bar (amber where money is overdue);
          zero buckets read "—". The bars are drawn from the API's figures, never printed as numbers of their own. */}
      <StatsRow
        label={t("figuresLabel")}
        highlight="total"
        figures={[
          {
            key: "total",
            label: t("totalBalance"),
            value: <span data-testid="arrears-total">{formatTHB(list.totals.balance, locale)}</span>,
            hint: t("parties", { count: list.totals.count }),
          },
          ...BUCKETS.map((key) => ({
            key,
            label: t(`bucket.${key}`),
            value: <span data-testid={`aging-${key}`}>{money(list.totals.aging[key])}</span>,
            href: ownerPath(locale, withQuery("/arrears", { bucket: key })),
            share: decimalShare(list.totals.aging[key], list.totals.balance),
            shareTone:
              key !== "current" && !isZeroDecimal(list.totals.aging[key]) ? ("warning" as const) : ("neutral" as const),
          })),
        ]}
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("view.label")}
            current={view}
            tabs={[
              {
                key: "all",
                href: ownerPath(locale, withQuery("/arrears", { q: param(searchParams.q), sort: sortBy })),
                label: t("view.all"),
                count: countAll,
              },
              {
                key: "overdue",
                href: ownerPath(locale, withQuery("/arrears", { q: param(searchParams.q), sort: sortBy, minDays: 1 })),
                label: t("view.overdue"),
                count: countOverdue,
              },
              {
                key: "notDue",
                href: ownerPath(
                  locale,
                  withQuery("/arrears", { q: param(searchParams.q), sort: sortBy, bucket: "current" }),
                ),
                label: t("view.notDue"),
                count: countNotDue,
              },
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              {
                name: "sort",
                label: t("filter.sort"),
                type: "select",
                placeholder: t("sort.balance"),
                options: SORTS.filter((value) => value !== "balance").map((value) => ({
                  value,
                  label: t(`sort.${value}`),
                })),
              },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/arrears")}>{t("empty.clear")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/payments")}>{t("empty.payments")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="arrears-table"
          stackOnPhones
          minWidth="60rem"
          footer={{
            party: t("grandTotal"),
            ...Object.fromEntries(BUCKETS.map((key) => [key, money(list.totals.aging[key])])),
            balance: formatTHB(list.totals.balance, locale),
          }}
          columns={[
            { key: "party", header: t("col.party"), phone: "title" },
            { key: "unit", header: t("col.unit"), phone: "meta" },
            { key: "days", header: t("col.days"), align: "end", phone: "status" },
            ...BUCKETS.map((key) => ({
              key,
              header: t(`bucket.${key}`),
              align: "end" as const,
              phone: "hidden" as const,
            })),
            { key: "balance", header: t("col.balance"), align: "end", phone: "figure" },
          ]}
          rows={list.data.map((row) => ({
            key: `${row.partyId}-${row.unitId ?? ""}`,
            href: ownerPath(locale, withQuery(`/arrears/${row.partyId}`, { unit: row.unitId })),
            testId: "arrears-row",
            data: { days: row.daysOverdue },
            cells: {
              party: (
                <span className="flex flex-col" data-testid="arrears-party">
                  <span>{row.partyName}</span>
                  <span className="text-muted text-sm font-normal">
                    {t("invoices", { count: row.openInvoicesCount })}
                  </span>
                </span>
              ),
              unit: (
                <span className="flex flex-col max-md:flex-row max-md:gap-1">
                  <span className="font-mono">{row.unitNo ?? "—"}</span>
                  <span className="text-muted text-sm">{row.buildingName}</span>
                </span>
              ),
              days: (
                <span className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                  {row.daysOverdue > 0 ? (
                    <Badge tone="danger" size="sm" icon={IconClock}>
                      {t("daysValue", { count: formatNumber(row.daysOverdue, locale) })}
                    </Badge>
                  ) : row.daysOverdue === 0 && row.oldestDueDate ? (
                    <Badge tone="warning" size="sm" icon={IconClock}>
                      {t("dueToday")}
                    </Badge>
                  ) : (
                    <span className="text-muted text-sm">{t("notDueYet")}</span>
                  )}
                  {row.oldestDueDate ? (
                    <span className="text-muted text-sm max-md:hidden">{formatDate(row.oldestDueDate, locale)}</span>
                  ) : null}
                </span>
              ),
              ...Object.fromEntries(BUCKETS.map((key) => [key, money(row.aging[key])])),
              balance: <span className="font-semibold whitespace-nowrap">{formatTHB(row.balance, locale)}</span>,
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/arrears")}
        searchParams={searchParams}
        locale={locale}
      />
      <Card as="section" aria-labelledby="arrears-policy" data-testid="arrears-policy">
        <CardHeader
          title={<span id="arrears-policy">{t("policy")}</span>}
          description={t("policyHint")}
          action={
            <a className="text-sm underline-offset-4 hover:underline" href={ownerPath(locale, "/settings")}>
              {t("changeSettings")}
            </a>
          }
        />
        <DescriptionList
          items={policy.map((setting) => ({
            id: setting.key,
            term: t.has(`setting.${messageKey(setting.key)}` as never)
              ? t(`setting.${messageKey(setting.key)}` as never)
              : setting.key,
            description: <SettingValue setting={setting} locale={locale} />,
          }))}
        />
      </Card>
    </OwnerPage>
  );
}
