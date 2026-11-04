import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { TENANT_STATUS } from "@/domain/status/tenant";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { LinkMenu } from "@/features/shared/console/LinkMenu";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { viewCounts } from "@/features/shared/console/views";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconBuilding } from "@/ui/icons/glyphs/building";

import { can, pageParam, param, section, type AdminContext } from "../shared/server";
import { OnboardTenant } from "./OnboardTenant";
import { tenantSectionHref, tenantSections } from "./sections";

type SearchParams = Record<string, string | string[] | undefined>;

const STATES = ["active", "trial", "past_due", "suspended"] as const;

/**
 * Tenants (F5 5.1, D-151, redesign G8): the SaaS customer organisations. The figures are the API's totals (customers,
 * then subscriptions per state, the suspended one marked when any); one toolbar with the search; a dense table whose
 * rows open the customer's record — rows of their own on a phone — with the record's other pages in one "⋯".
 */
export async function TenantsView({ context, searchParams }: { context: AdminContext; searchParams: SearchParams }) {
  const t = await getTranslations("admin.tenants");
  const types = await getTranslations("glossary.tenantType");
  const states = await getTranslations("status.subscription");
  const { api, me, locale } = context;
  const q = param(searchParams.q);
  const billing = can(me, "admin.subscription.manage");
  const [list, subscriptions, plans, counts] = await Promise.all([
    unwrap(api.GET("/v1/admin/tenants", { params: { query: { page: pageParam(searchParams.page), perPage: 25, q } } })),
    section(unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { perPage: 100 } } }))),
    can(me, "admin.tenant.manage") ? section(unwrap(api.GET("/v1/admin/price-plans"))) : { data: null },
    billing
      ? viewCounts(STATES, (state) =>
          unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { state, perPage: 1 } } })),
        )
      : Promise.resolve({} as Partial<Record<(typeof STATES)[number], number>>),
  ]);
  const subscriptionOf = new Map<string, Schemas["SubscriptionDto"]>(
    (subscriptions.data?.data ?? []).filter((sub) => sub.state !== "cancelled").map((sub) => [sub.tenantId, sub]),
  );
  const sections = tenantSections(me).filter((key) => key !== "overview");

  return (
    <ConsolePage testId="tenants">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          can(me, "admin.tenant.manage") ? (
            <OnboardTenant
              plans={(plans.data ?? [])
                .filter((plan) => plan.isActive && plan.kind === "software")
                .map((plan) => ({ key: plan.key, name: plan.nameTh, tenantType: plan.tenantType }))}
            />
          ) : null
        }
      />
      <StatsRow
        label={t("figures.label")}
        highlight={counts.suspended ? "suspended" : undefined}
        figures={[
          { key: "all", label: t("figures.all"), value: formatNumber(list.meta.total, locale) },
          ...STATES.filter((state) => counts[state] !== undefined).map((state) => ({
            key: state,
            label: states(state),
            value: formatNumber(counts[state]!, locale),
            href: `/subscriptions?state=${state}`,
          })),
        ]}
      />
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBuilding}
          title={q ? t("empty.filteredTitle") : t("empty.title")}
          description={q ? t("empty.filteredBody") : t("empty.body")}
          action={
            q ? (
              <Button asChild variant="secondary">
                <Link href="/tenants">{t("empty.clear")}</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/subscriptions/plans">{t("empty.plans")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="tenant-table"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "name", header: t("col.name"), phone: "title" },
            { key: "type", header: t("col.type"), phone: "meta" },
            { key: "plan", header: t("col.plan"), phone: "meta" },
            { key: "since", header: t("col.since"), phone: "hidden" },
            { key: "subscription", header: t("col.subscription"), phone: "status" },
            { key: "status", header: t("col.status"), phone: "hidden" },
            {
              key: "menu",
              header: <span className="sr-only">{t("col.more")}</span>,
              phone: "hidden",
              className: "w-14",
            },
          ]}
          rows={list.data.map((tenant) => {
            const sub = subscriptionOf.get(tenant.id);
            return {
              key: tenant.id,
              href: tenantSectionHref(tenant.id, "overview"),
              testId: "tenant-row",
              data: { slug: tenant.slug, status: tenant.status },
              cells: {
                name: (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{tenant.displayName}</span>
                    <span className="text-muted truncate font-mono text-xs font-normal">{tenant.slug}</span>
                  </span>
                ),
                type: types(tenant.type),
                plan: sub?.plan.nameTh ?? tenant.plan ?? <span className="text-muted">{t("noPlan")}</span>,
                since: sub ? (
                  <span className="whitespace-nowrap">{formatDate(sub.startedAt, locale)}</span>
                ) : (
                  <span className="text-muted">—</span>
                ),
                subscription: sub ? (
                  <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={sub.state} size="sm" />
                ) : (
                  <span className="text-muted text-sm">{t("noSubscription")}</span>
                ),
                status:
                  tenant.status === "active" ? (
                    <span className="text-muted text-sm">{t("accountActive")}</span>
                  ) : (
                    <StatusBadgeOf map={TENANT_STATUS} value={tenant.status} size="sm" />
                  ),
                menu: (
                  <span className="relative z-2 flex justify-end">
                    <LinkMenu
                      variant="ghost"
                      label={t("rowMenu", { name: tenant.displayName })}
                      items={sections.map((key) => ({
                        id: key,
                        label: t(`tab.${key}`),
                        href: tenantSectionHref(tenant.id, key),
                      }))}
                    />
                  </span>
                ),
              },
            };
          })}
        />
      )}
      <ListPagination meta={list.meta} path="/tenants" searchParams={searchParams} locale={locale} />
    </ConsolePage>
  );
}
