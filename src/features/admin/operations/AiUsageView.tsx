import { getTranslations } from "next-intl/server";

import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatPeriodKey, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { pageParam, section, type AdminContext } from "../shared/server";

/** The newest month's rows of a tenant's usage (the API lists months newest first or not — sorted here by key only). */
function latest(months: Schemas["AiUsageMonthDto"][]): Schemas["AiUsageMonthDto"][] {
  const newest = months.reduce<string | null>((max, row) => (max === null || row.month > max ? row.month : max), null);
  return months.filter((row) => row.month === newest);
}

/**
 * AI usage across tenants (F5, D-125, O-009): for each tenant of the page, the newest month the API
 * counted — calls, units, allowance and overage per feature, and the API's cost — with a link to the
 * tenant's full history. Costs are the API's strings; nothing is summed here.
 */
export async function AiUsageView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.operations.ai");
  const features = await getTranslations("admin.tenants.ai.feature");
  const { api, locale } = context;
  const tenants = await unwrap(
    api.GET("/v1/admin/tenants", { params: { query: { page: pageParam(searchParams.page), perPage: 25 } } }),
  );
  const usage = await Promise.all(
    tenants.data.map(async (tenant) => ({
      tenant,
      usage: await section(
        unwrap(api.GET("/v1/admin/tenants/{tenantId}/ai-usage", { params: { path: { tenantId: tenant.id } } })),
      ),
    })),
  );
  return (
    <ConsolePage testId="ai-usage">
      <PageHeader title={t("title")} description={t("description")} />
      <SimpleTable
        caption={t("title")}
        testId="ai-table"
        stackOnPhones
        minWidth="56rem"
        columns={[
          { key: "tenant", header: t("col.tenant"), phone: "title" },
          { key: "month", header: t("col.month"), phone: "meta", phoneLabel: true },
          { key: "features", header: t("col.features"), phone: "meta" },
          { key: "cost", header: t("col.cost"), align: "end", phone: "figure" },
        ]}
        rows={usage.map(({ tenant, usage: result }) => {
          const rows = result.data ? latest(result.data.months) : [];
          const over = rows.some((row) => row.overage > 0);
          return {
            key: tenant.id,
            testId: "ai-row",
            href: `/tenants/${tenant.id}/ai-usage`,
            data: { slug: tenant.slug, overage: over },
            cells: {
              tenant: (
                <span className="flex flex-col">
                  <span className="font-semibold">{tenant.displayName}</span>
                  <span className="text-muted font-mono text-xs font-normal">{tenant.slug}</span>
                </span>
              ),
              month: rows[0] ? formatPeriodKey(rows[0].month.slice(0, 7), locale) : "—",
              features: !result.data ? (
                <SectionError error={result.error} />
              ) : rows.length === 0 ? (
                <span className="text-muted">{t("none")}</span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {rows.map((row) => (
                    <li key={row.feature} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{features(row.feature)}</span>
                      <span>
                        {t("units", {
                          units: formatNumber(row.units, locale),
                          allowance: row.allowance === null ? t("unlimited") : formatNumber(row.allowance, locale),
                        })}
                      </span>
                      {row.overage > 0 ? (
                        <Badge size="sm" tone="warning">
                          {t("overage", { count: row.overage })}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ),
              cost: rows.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {rows.map((row) => (
                    <li key={row.feature} className="whitespace-nowrap">
                      {formatTHB(row.costThb, locale)}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              ),
            },
          };
        })}
      />
      <ListPagination meta={tenants.meta} path="/ai-usage" searchParams={searchParams} locale={locale} />
    </ConsolePage>
  );
}
