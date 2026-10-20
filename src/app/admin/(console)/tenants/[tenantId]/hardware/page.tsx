import { getTranslations } from "next-intl/server";

import { adminContext } from "@/features/admin/shared/server";
import { loadTenant, TenantFrame } from "@/features/admin/tenants/TenantFrame";
import { HardwareTable } from "@/features/admin/billing/HardwareView";

export async function generateMetadata({ params }: { params: Promise<{ tenantId: string }> }) {
  const [{ tenantId }, context, t] = await Promise.all([params, adminContext(), getTranslations("admin.tenants.tab")]);
  const tenant = await loadTenant(context, tenantId);
  return { title: `${tenant.displayName} · ${t("hardware")}` };
}

/** A tenant — hardware (F5 5.1). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tenantId }, context] = await Promise.all([params, adminContext()]);
  const tenant = await loadTenant(context, tenantId);
  const query = await searchParams;
  return (
    <TenantFrame context={context} tenant={tenant} current="hardware">
      <HardwareTable
        context={context}
        searchParams={query}
        tenantId={tenant.id}
        path={`/tenants/${tenant.id}/hardware`}
      />
    </TenantFrame>
  );
}
