import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { AssetGrantMenu, CreateAssetGrant } from "./AccessActions";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

/**
 * Settings › Building access (F2 2.6, D-152; redesign G6): buildings or units this tenant opened to another getproperty
 * customer (a PM company, a contractor, a landlord's portal) or that another opened to it — who, what, how much access,
 * for what and until when; "ให้สิทธิ์" for the Owner, revoke in each row's "⋯".
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
  const grantable = buildings
    .filter((b) => b.access === "owner" || b.access === "operator")
    .map((b) => ({ id: b.id, name: b.name }));
  const buildingName = (id: string) => buildings.find((building) => building.id === id)?.name ?? t("otherBuilding");
  const moduleName = (key: string) => (t.has(`module.${key}`) ? t(`module.${key}` as never) : null);
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/access-grants"
      title={t("title")}
      description={t("description")}
      actions={manage ? <CreateAssetGrant buildings={grantable} /> : null}
      testId="access-grants"
    >
      {!grants.data ? (
        <SectionError error={grants.error} />
      ) : grants.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconKey}
          title={t("empty")}
          description={t("emptyHint")}
          action={manage ? <CreateAssetGrant buildings={grantable} testId="create-grant-empty" secondary /> : null}
        />
      ) : (
        <SettingsCard id="grants-list" title={t("listTitle")} description={t("listHint")} flush>
          <SimpleTable
            caption={t("title")}
            testId="grant-table"
            minWidth="48rem"
            stackOnPhones
            className="rounded-none border-0 shadow-none"
            columns={[
              { key: "building", header: t("col.building"), phone: "title" },
              { key: "direction", header: t("col.direction"), phone: "meta" },
              { key: "access", header: t("col.access"), phone: "meta" },
              { key: "valid", header: t("col.valid"), className: "whitespace-nowrap", phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "figure",
              },
            ]}
            rows={grants.data.map((grant) => {
              const given = grant.tenantId === own;
              const modules = grant.modules.map(moduleName).filter(Boolean);
              return {
                key: grant.id,
                testId: "grant-row",
                data: { revoked: grant.revokedAt !== null },
                cells: {
                  building: (
                    <span className="flex flex-col">
                      <span className="font-medium">{buildingName(grant.buildingId)}</span>
                      {grant.unitId ? <span className="text-muted text-sm">{t("unitScope")}</span> : null}
                    </span>
                  ),
                  direction: given ? t("givenTo") : t("received"),
                  access: (
                    <span className="flex flex-col gap-0.5">
                      <span>
                        {t(`accessName.${grant.access}`)} · {t(`reasonName.${grant.reason}`)}
                      </span>
                      <span className="text-muted text-sm">
                        {grant.modules.length === 0 ? t("allModules") : modules.join(", ") || t("someModules")}
                      </span>
                    </span>
                  ),
                  valid: grant.revokedAt ? (
                    <StatusText tone="muted" icon={IconXCircle}>
                      {t("revokedOn", { date: formatDate(grant.revokedAt, locale) })}
                    </StatusText>
                  ) : (
                    <StatusText
                      tone="success"
                      icon={IconCheckCircle}
                      detail={`${formatDate(grant.validFrom, locale)} – ${grant.validTo ? formatDate(grant.validTo, locale) : t("noEnd")}`}
                    >
                      {t("active")}
                    </StatusText>
                  ),
                  actions: manage && given && !grant.revokedAt ? <AssetGrantMenu grant={grant} /> : "",
                },
              };
            })}
          />
        </SettingsCard>
      )}
    </SettingsFrame>
  );
}
