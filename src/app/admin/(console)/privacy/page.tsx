import { getTranslations } from "next-intl/server";

import { PrivacyView } from "@/features/admin/operations/PrivacyView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("data_subject_requests") };
}

/** PDPA data subject requests across tenants (F5 5.2). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PrivacyView context={await adminContext()} searchParams={await searchParams} />;
}
