import { getTranslations } from "next-intl/server";

import { ProviderCredentialsPanel } from "@/features/admin/credentials/ProviderCredentialsPanel";
import { adminContext } from "@/features/admin/shared/server";
import { loadTenant, TenantFrame } from "@/features/admin/tenants/TenantFrame";

export async function generateMetadata({ params }: { params: Promise<{ tenantId: string }> }) {
  const [{ tenantId }, context, t] = await Promise.all([params, adminContext(), getTranslations("admin.tenants.tab")]);
  const tenant = await loadTenant(context, tenantId);
  return { title: `${tenant.displayName} · ${t("credentials")}` };
}

/** A tenant — provider credentials: payment merchants, lock vendor accounts, e-Tax account (F11-4, D-240). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tenantId }, context, query] = await Promise.all([params, adminContext(), searchParams]);
  const tenant = await loadTenant(context, tenantId);
  return (
    <TenantFrame context={context} tenant={tenant} current="credentials">
      <ProviderCredentialsPanel
        context={context}
        scope={{ type: "tenant", tenantId: tenant.id }}
        searchParams={query}
      />
    </TenantFrame>
  );
}
