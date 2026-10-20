import { getTranslations } from "next-intl/server";

import { adminContext } from "@/features/admin/shared/server";
import { loadTenant, TenantFrame } from "@/features/admin/tenants/TenantFrame";
import { ViewAsTenant } from "@/features/admin/support/ViewAsTenant";

export async function generateMetadata({ params }: { params: Promise<{ tenantId: string }> }) {
  const [{ tenantId }, context, t] = await Promise.all([params, adminContext(), getTranslations("admin.tenants.tab")]);
  const tenant = await loadTenant(context, tenantId);
  return { title: `${tenant.displayName} · ${t("view")}` };
}

/** A tenant — view (F5 5.1). */
export default async function Page({ params }: { params: Promise<{ tenantId: string }> }) {
  const [{ tenantId }, context] = await Promise.all([params, adminContext()]);
  const tenant = await loadTenant(context, tenantId);
  return (
    <TenantFrame context={context} tenant={tenant} current="view">
      <ViewAsTenant context={context} tenant={tenant} />
    </TenantFrame>
  );
}
