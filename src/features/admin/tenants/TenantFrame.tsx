import "server-only";

import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TENANT_STATUS } from "@/domain/status/tenant";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { AdminMe, Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { can, type AdminContext } from "../shared/server";

export type TenantTab =
  | "overview"
  | "subscription"
  | "invoices"
  | "hardware"
  | "field-work"
  | "pilot"
  | "ai-usage"
  | "flags"
  | "credentials"
  | "support"
  | "view";

/** The tabs a platform user may open (docs/rbac.md): the API refuses the rest anyway. */
function tabsFor(me: AdminMe): TenantTab[] {
  const tabs: TenantTab[] = ["overview"];
  const business = can(me, "admin.subscription.manage");
  if (business) tabs.push("subscription", "invoices");
  if (business || can(me, "admin.device.manage")) tabs.push("hardware", "field-work");
  if (business) tabs.push("pilot");
  if (can(me, "admin.ai_usage.read")) tabs.push("ai-usage");
  tabs.push("flags");
  if (can(me, "admin.provider_credential.manage")) tabs.push("credentials");
  if (can(me, "admin.support_grant.request") || can(me, "admin.support_grant.approve_incident")) tabs.push("support");
  tabs.push("view");
  return tabs;
}

/** The tenant of a detail page, or the not-found page (404 from the API, cross-check by id). */
export async function loadTenant(context: AdminContext, tenantId: string): Promise<Schemas["TenantProfileDto"]> {
  try {
    return await unwrap(context.api.GET("/v1/admin/tenants/{tenantId}", { params: { path: { tenantId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
}

/**
 * A tenant's pages (F5 5.1): the tenant's name, type and status, and its tabs — overview & health,
 * subscription, platform invoices, rented hardware, install orders & surveys, pilot & KPIs, AI usage,
 * feature flags, provider credentials (D-240), support grants and the read-only "view as tenant".
 */
export async function TenantFrame({
  context,
  tenant,
  current,
  children,
  actions,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
  current: TenantTab;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const t = await getTranslations("admin.tenants");
  const types = await getTranslations("glossary.tenantType");
  const base = `/tenants/${tenant.id}`;
  const href = (tab: TenantTab) => (tab === "overview" ? base : `${base}/${tab}`);
  return (
    <ConsolePage testId={`tenant-${current}`}>
      <PageHeader
        title={tenant.displayName}
        testId="tenant-title"
        crumbs={[{ label: tenant.displayName }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{tenant.slug}</span>
            <span aria-hidden="true">·</span>
            <span>{types(tenant.type)}</span>
            {tenant.vatRegistered ? <Badge size="sm">{t("vatRegistered")}</Badge> : null}
          </span>
        }
        status={<StatusBadgeOf map={TENANT_STATUS} value={tenant.status} />}
        actions={actions}
      />
      <LinkTabs
        label={t("tabsLabel")}
        current={href(current)}
        tabs={tabsFor(context.me).map((tab) => ({
          href: href(tab),
          label: t(`tab.${tab}`),
          testId: `tenant-tab-${tab}`,
        }))}
      />
      {children}
    </ConsolePage>
  );
}
