import { getTranslations } from "next-intl/server";

import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Stat } from "@/ui/components/Stat";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { ExportButton } from "../shared/ExportButton";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../shared/server";
import { SettingValue } from "../shared/SettingValue";
import { heldCount, slipsToReview } from "./counts";

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
  const [list, settings, slips, held] = await Promise.all([
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
    slipsToReview(api),
    heldCount(api, building?.id),
  ]);
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
      <MoneyNav
        section="payments"
        current="/arrears"
        locale={locale}
        counts={{ "/payments/slips": slips, "/payments/held": held }}
      />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="aging-totals">
        <Stat
          label={t("totalBalance")}
          value={<span data-testid="arrears-total">{formatTHB(list.totals.balance, locale)}</span>}
          hint={t("parties", { count: list.totals.count })}
        />
        {BUCKETS.map((key) => (
          <Stat
            key={key}
            label={t(`bucket.${key}`)}
            value={<span data-testid={`aging-${key}`}>{formatTHB(list.totals.aging[key], locale)}</span>}
          />
        ))}
      </div>
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "bucket",
            label: t("filter.bucket"),
            type: "select",
            placeholder: t("filter.allBuckets"),
            options: BUCKETS.map((value) => ({ value, label: t(`bucket.${value}`) })),
          },
          { name: "minDays", label: t("filter.minDays"), type: "number", min: 0 },
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
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <div className="border-border bg-surface rounded-card overflow-x-auto border">
          <table className="w-full min-w-[56rem] text-sm" data-testid="arrears-table">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr className="border-border text-muted border-b">
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("col.party")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("col.unit")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("col.balance")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("col.days")}
                </th>
                {BUCKETS.map((key) => (
                  <th key={key} scope="col" className="px-3 py-2 text-end font-medium">
                    {t(`bucket.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr
                  key={`${row.partyId}-${row.unitId ?? ""}`}
                  className="border-border border-b"
                  data-testid="arrears-row"
                  data-days={row.daysOverdue}
                >
                  <th scope="row" className="px-3 py-2 text-start font-normal">
                    <a
                      className="font-medium underline-offset-4 hover:underline"
                      href={ownerPath(locale, withQuery(`/arrears/${row.partyId}`, { unit: row.unitId }))}
                      data-testid="arrears-party"
                    >
                      {row.partyName}
                    </a>
                    <span className="text-muted block text-xs">{t("invoices", { count: row.openInvoicesCount })}</span>
                  </th>
                  <td className="px-3 py-2">
                    <span className="font-mono">{row.unitNo ?? "—"}</span>
                    <span className="text-muted block text-xs">{row.buildingName}</span>
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{formatTHB(row.balance, locale)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {formatNumber(row.daysOverdue, locale)}
                    {row.oldestDueDate ? (
                      <span className="text-muted block text-xs">{formatDate(row.oldestDueDate, locale)}</span>
                    ) : null}
                  </td>
                  {BUCKETS.map((key) => (
                    <td key={key} className="px-3 py-2 text-end tabular-nums">
                      {formatTHB(row.aging[key], locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            term: t.has(`setting.${setting.key}` as never) ? t(`setting.${setting.key}` as never) : setting.key,
            description: <SettingValue setting={setting} locale={locale} />,
          }))}
        />
      </Card>
    </OwnerPage>
  );
}
