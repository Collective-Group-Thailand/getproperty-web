import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBuilding } from "@/ui/icons/glyphs/building";

import { can, section, type AdminContext } from "../shared/server";
import { ChangeOperatorButton, ClaimStubButton, type OperatorOption } from "./BuildingActions";
import { tenantSectionHref } from "./sections";

/** Juristic tenant types (`condo_juristic` is the deprecated alias of `juristic`, D-302). */
export const isJuristicType = (type: Schemas["TenantType"]) => type === "juristic" || type === "condo_juristic";

/**
 * A tenant's buildings (pack J, D-280, D-302): what it owns or operates, and the two platform moves of a building —
 * a juristic person taking over the stub its landlords created (with the property's kind and the building's legal
 * form), and a change of operator (a PM company's contract starting or ending, a juristic person formed), which names
 * the legal form when the new operator is juristic. Structure only, no business data (D-206).
 */
/** Tenants that may operate a building (not landlords or agencies), for the operator pickers. */
export async function operatorOptions(context: AdminContext): Promise<OperatorOption[]> {
  const tenants = await section(unwrap(context.api.GET("/v1/admin/tenants", { params: { query: { perPage: 100 } } })));
  return (tenants.data?.data ?? [])
    .filter((candidate) => candidate.type !== "landlord" && candidate.type !== "agency")
    .map((candidate) => ({ id: candidate.id, name: candidate.displayName, juristic: isJuristicType(candidate.type) }));
}

export async function TenantBuildings({
  context,
  tenant,
  operators,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
  operators: OperatorOption[];
}) {
  const t = await getTranslations("admin.tenants.buildings");
  const { api, me } = context;
  const manage = can(me, "admin.tenant.manage");
  const buildings = await section(
    unwrap(api.GET("/v1/admin/tenants/{tenantId}/buildings", { params: { path: { tenantId: tenant.id } } })),
  );
  if (!buildings.data) return <SectionError error={buildings.error} />;
  return (
    <div className="flex flex-col gap-4">
      {buildings.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBuilding}
          title={t("emptyTitle")}
          description={isJuristicType(tenant.type) ? t("emptyJuristic") : t("empty")}
          action={
            manage && isJuristicType(tenant.type) ? (
              <ClaimStubButton tenant={{ id: tenant.id, name: tenant.displayName }} operators={operators} secondary />
            ) : (
              <Button asChild variant="secondary">
                <a href={tenantSectionHref(tenant.id, "overview")}>{t("backToTenant")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("caption")}
          testId="tenant-buildings"
          stackOnPhones
          minWidth="44rem"
          columns={[
            { key: "name", header: t("col.name"), phone: "title" },
            { key: "property", header: t("col.property"), phone: "meta" },
            { key: "roles", header: t("col.roles"), phone: "meta" },
            { key: "units", header: t("col.units"), align: "end", phone: "figure" },
            ...(manage
              ? [
                  {
                    key: "actions",
                    header: <span className="sr-only">{t("col.actions")}</span>,
                    align: "end" as const,
                    phone: "meta" as const,
                  },
                ]
              : []),
          ]}
          rows={buildings.data.map((building) => ({
            key: building.id,
            testId: "tenant-building",
            cells: {
              name: (
                <span className="flex flex-col">
                  <span className="font-medium">{building.name}</span>
                  <span className="text-muted font-mono text-xs">{building.code}</span>
                </span>
              ),
              property: building.propertyName,
              roles: building.roles.map((role) => t(`role.${role}`)).join(" · "),
              units: formatNumber(building.unitCount, "th"),
              actions: manage ? <ChangeOperatorButton building={building} operators={operators} /> : null,
            },
          }))}
        />
      )}
    </div>
  );
}
