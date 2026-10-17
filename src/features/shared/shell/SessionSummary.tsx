import { getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";

import { TenantSwitcher } from "./TenantSwitcher";

/**
 * Who and where: the current tenant (a switcher when the operator has several) and the role in it —
 * straight from `/me`, so what the header says is what the API will enforce.
 */
export async function SessionSummary({
  zone,
  me,
}: {
  zone: "owner" | "staff";
  me: Schemas["OperatorMeDto"] & { currentTenant: Schemas["CurrentTenantDto"] };
}) {
  const t = await getTranslations();
  const tenant = me.currentTenant;
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="session-summary">
      {me.tenants.length > 1 ? (
        <TenantSwitcher zone={zone} tenants={me.tenants} currentTenantId={tenant.id} />
      ) : (
        <span className="truncate text-sm font-semibold" data-testid="tenant-name">
          {tenant.displayName}
        </span>
      )}
      <span className="text-muted hidden truncate text-xs sm:inline" data-testid="tenant-role">
        {t(`glossary.tenantRole.${tenant.role}`)}
      </span>
    </div>
  );
}
