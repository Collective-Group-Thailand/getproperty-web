import { getTranslations } from "next-intl/server";

import { AuditView } from "@/features/admin/operations/AuditView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("audit_log") };
}

/** Platform audit search (F5 5.2). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AuditView context={await adminContext()} searchParams={await searchParams} />;
}
