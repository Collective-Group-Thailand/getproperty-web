import { getTranslations } from "next-intl/server";

import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { TENANT_STATUS } from "@/domain/status/tenant";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";

import { can, pageParam, param, section, type AdminContext } from "../shared/server";
import { OnboardTenant } from "./OnboardTenant";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Tenants (F5 5.1, D-151): the SaaS customer organisations with type, plan, status and subscription
 * state, searchable by name or slug; onboarding for the platform admin (D-161).
 */
export async function TenantsView({ context, searchParams }: { context: AdminContext; searchParams: SearchParams }) {
  const t = await getTranslations("admin.tenants");
  const types = await getTranslations("glossary.tenantType");
  const { api, me } = context;
  const [list, subscriptions, plans] = await Promise.all([
    unwrap(
      api.GET("/v1/admin/tenants", {
        params: { query: { page: pageParam(searchParams.page), perPage: 25, q: param(searchParams.q) } },
      }),
    ),
    section(unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { perPage: 100 } } }))),
    can(me, "admin.tenant.manage") ? section(unwrap(api.GET("/v1/admin/price-plans"))) : { data: null },
  ]);
  const subscriptionOf = new Map<string, Schemas["SubscriptionDto"]>(
    (subscriptions.data?.data ?? []).filter((sub) => sub.state !== "cancelled").map((sub) => [sub.tenantId, sub]),
  );

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
      <FilterBar fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]} />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="tenant-table"
          columns={[
            { key: "name", header: t("col.name") },
            { key: "type", header: t("col.type") },
            { key: "plan", header: t("col.plan") },
            { key: "subscription", header: t("col.subscription") },
            { key: "status", header: t("col.status") },
          ]}
          rows={list.data.map((tenant) => {
            const sub = subscriptionOf.get(tenant.id);
            return {
              key: tenant.id,
              testId: "tenant-row",
              data: { slug: tenant.slug, status: tenant.status },
              cells: {
                name: (
                  <a href={`/tenants/${tenant.id}`} className="flex flex-col hover:underline">
                    <span className="font-semibold">{tenant.displayName}</span>
                    <span className="text-muted font-mono text-xs">{tenant.slug}</span>
                  </a>
                ),
                type: types(tenant.type),
                plan: sub?.plan.nameTh ?? tenant.plan ?? t("noPlan"),
                subscription: sub ? (
                  <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={sub.state} size="sm" />
                ) : (
                  <span className="text-muted">{t("noSubscription")}</span>
                ),
                status: <StatusBadgeOf map={TENANT_STATUS} value={tenant.status} size="sm" />,
              },
            };
          })}
        />
      )}
      <ListPagination meta={list.meta} path="/tenants" searchParams={searchParams} locale={context.locale} />
    </ConsolePage>
  );
}
