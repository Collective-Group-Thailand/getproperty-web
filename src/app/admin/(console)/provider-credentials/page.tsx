import { getTranslations } from "next-intl/server";

import { ProviderCredentialsPanel } from "@/features/admin/credentials/ProviderCredentialsPanel";
import { adminContext, tenantNames } from "@/features/admin/shared/server";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";

export async function generateMetadata() {
  const t = await getTranslations("admin.credentials");
  return { title: t("title") };
}

/**
 * Provider credentials across tenants and the platform merchant (F11-4, D-240). No menu entry (the API's admin
 * menu has no key for it): reached from the platform settings and from each tenant's page.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query, names, t] = await Promise.all([
    adminContext(),
    searchParams,
    tenantNames(),
    getTranslations("admin.credentials"),
  ]);
  return (
    <ConsolePage testId="provider-credentials-page">
      <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
      <ProviderCredentialsPanel context={context} scope={{ type: "all", names }} searchParams={query} />
    </ConsolePage>
  );
}
