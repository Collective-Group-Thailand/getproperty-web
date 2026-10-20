import { getTranslations } from "next-intl/server";

import { adminContext } from "@/features/admin/shared/server";
import { TenantsView } from "@/features/admin/tenants/TenantsView";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("tenants") };
}

/** Tenants (F5 5.1). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TenantsView context={await adminContext()} searchParams={await searchParams} />;
}
