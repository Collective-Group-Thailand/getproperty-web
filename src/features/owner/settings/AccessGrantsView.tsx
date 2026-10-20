import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { CreateAssetGrant, RevokeAssetGrant } from "./AccessActions";
import { SettingsNav } from "./SettingsNav";

/**
 * Asset access grants (F2 2.6, D-152): buildings or units this tenant opened to another tenant (a PM
 * company, a contractor, a landlord's portal) or that another tenant opened to it — access, modules,
 * reason and validity; grant and revoke for the Owner.
 */
export async function AccessGrantsView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.grants");
  const { api, locale, me, buildings } = context;
  const grants = await section(unwrap(api.GET("/v1/owner/asset-grants")));
  const manage = ownerCan(me, "tenant.grant.manage") && !readOnly(me);
  const own = me.currentTenant?.id;
  const buildingName = (id: string) => buildings.find((building) => building.id === id)?.name ?? id.slice(0, 8);
  return (
    <OwnerPage testId="access-grants">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          manage ? (
            <CreateAssetGrant
              buildings={buildings
                .filter((b) => b.access === "owner" || b.access === "operator")
                .map((b) => ({ id: b.id, name: b.name }))}
            />
          ) : null
        }
      />
      <SettingsNav me={me} current="/settings/access-grants" locale={locale} />
      {!grants.data ? (
        <SectionError error={grants.error} />
      ) : grants.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="grant-table"
          minWidth="56rem"
          columns={[
            { key: "direction", header: t("col.direction") },
            { key: "building", header: t("col.building") },
            { key: "access", header: t("col.access") },
            { key: "valid", header: t("col.valid") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={grants.data.map((grant) => {
            const given = grant.tenantId === own;
            return {
              key: grant.id,
              testId: "grant-row",
              data: { revoked: grant.revokedAt !== null },
              cells: {
                direction: given ? t("given", { tenant: grant.granteeTenantId.slice(0, 8) }) : t("received"),
                building: `${buildingName(grant.buildingId)}${grant.unitId ? ` · ${t("unitScope")}` : ""}`,
                access: (
                  <span className="flex flex-col gap-1">
                    <span>
                      {t(`accessName.${grant.access}`)} · {t(`reasonName.${grant.reason}`)}
                    </span>
                    {grant.modules.length ? (
                      <span className="text-muted text-xs">{grant.modules.join(", ")}</span>
                    ) : null}
                  </span>
                ),
                valid: grant.revokedAt ? (
                  <Badge size="sm">{t("revokedOn", { date: formatDate(grant.revokedAt, locale) })}</Badge>
                ) : (
                  `${formatDate(grant.validFrom, locale)} – ${grant.validTo ? formatDate(grant.validTo, locale) : t("noEnd")}`
                ),
                actions: manage && given && !grant.revokedAt ? <RevokeAssetGrant grant={grant} /> : null,
              },
            };
          })}
        />
      )}
    </OwnerPage>
  );
}
