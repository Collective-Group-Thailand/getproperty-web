import { getTranslations } from "next-intl/server";

import { SUPPORT_GRANT_STATUS } from "@/domain/status/supportGrant";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconShow } from "@/ui/icons/glyphs/show";

import { can, section, type AdminContext } from "../shared/server";
import { GrantActions, RequestSupportGrant } from "./SupportActions";

/** Whether a grant opens the tenant to Support right now (active and within its window). */
export function isLive(grant: Schemas["SupportGrantDto"], now = Date.now()): boolean {
  return grant.state === "active" && grant.validTo !== null && Date.parse(grant.validTo) > now;
}

/**
 * Support grants (F5 5.1, D-090, D-206): requested, active and past grants with their reason,
 * ticket, how they were approved (Owner in-app or platform admin for an incident) and window; the
 * actions the API offers; "view as tenant" while a grant is live (platform admins read without one,
 * audited as a bypass).
 */
export async function GrantsTable({
  context,
  grants,
  tenantNames,
}: {
  context: AdminContext;
  grants: Schemas["SupportGrantDto"][];
  tenantNames: Map<string, string>;
}) {
  const t = await getTranslations("admin.support");
  const { locale } = context;
  if (grants.length === 0)
    return (
      <Card>
        <EmptyState icon={IconChat} title={t("empty")} description={t("emptyHint")} />
      </Card>
    );
  return (
    <SimpleTable
      caption={t("title")}
      testId="support-grants"
      minWidth="56rem"
      columns={[
        { key: "tenant", header: t("col.tenant") },
        { key: "reason", header: t("col.reason") },
        { key: "window", header: t("col.window") },
        { key: "state", header: t("col.state") },
        { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
      ]}
      rows={grants.map((grant) => {
        const name = tenantNames.get(grant.tenantId) ?? grant.tenantId.slice(0, 8);
        return {
          key: grant.id,
          testId: "support-grant",
          data: { state: grant.state, tenant: grant.tenantId },
          cells: {
            tenant: (
              <a href={`/tenants/${grant.tenantId}/support`} className="font-semibold hover:underline">
                {name}
              </a>
            ),
            reason: (
              <span className="flex flex-col">
                <span>{grant.reason}</span>
                <span className="text-muted text-xs">
                  {grant.ticketRef ? `${grant.ticketRef} · ` : ""}
                  {t("requestedAt", { date: formatDateTime(grant.createdAt, locale) })}
                  {grant.approvedVia ? ` · ${t(`via.${grant.approvedVia}`)}` : ""}
                </span>
              </span>
            ),
            window:
              grant.validFrom && grant.validTo
                ? `${formatDateTime(grant.validFrom, locale)} – ${formatDateTime(grant.validTo, locale)}`
                : "—",
            state: <StatusBadgeOf map={SUPPORT_GRANT_STATUS} value={grant.state} size="sm" />,
            actions: (
              <span className="flex flex-wrap items-center gap-1">
                {isLive(grant) ? (
                  <Button asChild size="sm" variant="secondary" iconStart={IconShow}>
                    <a href={`/tenants/${grant.tenantId}/view`} data-testid="view-as-tenant">
                      {t("viewAs")}
                    </a>
                  </Button>
                ) : null}
                <GrantActions grant={grant} tenantName={name} />
              </span>
            ),
          },
        };
      })}
    />
  );
}

/** Every support grant (the `support_grants` menu). */
export async function SupportView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.support");
  const { api } = context;
  const [grants, tenants] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/support-grants"))),
    section(unwrap(api.GET("/v1/admin/tenants", { params: { query: { perPage: 100 } } }))),
  ]);
  const names = new Map((tenants.data?.data ?? []).map((tenant) => [tenant.id, tenant.displayName]));
  return (
    <ConsolePage testId="support">
      <PageHeader title={t("title")} description={t("description")} />
      {!grants.data ? (
        <SectionError error={grants.error} />
      ) : (
        <GrantsTable context={context} grants={grants.data} tenantNames={names} />
      )}
    </ConsolePage>
  );
}

/** A tenant's grants, the request form, and the way into the read-only view. */
export async function TenantSupport({
  context,
  tenant,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
}) {
  const t = await getTranslations("admin.support");
  const { api, me } = context;
  const grants = await section(unwrap(api.GET("/v1/admin/support-grants")));
  if (!grants.data) return <SectionError error={grants.error} />;
  const mine = grants.data.filter((grant) => grant.tenantId === tenant.id);
  const live = mine.some((grant) => isLive(grant));
  const bypass = me.roles.includes("platform_admin");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-2xl text-sm">
          {bypass ? t("bypassHint") : live ? t("liveHint") : t("noLiveHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          {live || bypass ? (
            <Button asChild variant="secondary" iconStart={IconShow}>
              <a href={`/tenants/${tenant.id}/view`} data-testid="open-view-as">
                {t("viewAs")}
              </a>
            </Button>
          ) : null}
          {can(me, "admin.support_grant.request") ? (
            <RequestSupportGrant tenantId={tenant.id} tenantName={tenant.displayName} />
          ) : null}
        </div>
      </div>
      <GrantsTable context={context} grants={mine} tenantNames={new Map([[tenant.id, tenant.displayName]])} />
    </div>
  );
}
