import { getTranslations } from "next-intl/server";

import { adminContext, can } from "@/features/admin/shared/server";
import { ClaimStubButton } from "@/features/admin/tenants/BuildingActions";
import { isJuristicType, operatorOptions, TenantBuildings } from "@/features/admin/tenants/TenantBuildings";
import { loadTenant, TenantFrame } from "@/features/admin/tenants/TenantFrame";

export async function generateMetadata({ params }: { params: Promise<{ tenantId: string }> }) {
  const [{ tenantId }, context, t] = await Promise.all([params, adminContext(), getTranslations("admin.tenants.tab")]);
  const tenant = await loadTenant(context, tenantId);
  return { title: `${tenant.displayName} · ${t("buildings")}` };
}

/** A tenant — buildings: stub claim and operator change (pack J, D-280, D-302). */
export default async function Page({ params }: { params: Promise<{ tenantId: string }> }) {
  const [{ tenantId }, context] = await Promise.all([params, adminContext()]);
  const tenant = await loadTenant(context, tenantId);
  const manage = can(context.me, "admin.tenant.manage");
  const operators = manage ? await operatorOptions(context) : [];
  return (
    <TenantFrame
      context={context}
      tenant={tenant}
      current="buildings"
      actions={
        manage && isJuristicType(tenant.type) ? (
          <ClaimStubButton tenant={{ id: tenant.id, name: tenant.displayName }} operators={operators} />
        ) : undefined
      }
    >
      <TenantBuildings context={context} tenant={tenant} operators={operators} />
    </TenantFrame>
  );
}
