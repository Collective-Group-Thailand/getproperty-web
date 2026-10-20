import { getTranslations } from "next-intl/server";

import { adminContext } from "@/features/admin/shared/server";
import { TariffDetail } from "@/features/admin/tariffs/TariffsView";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("utility_tariffs") };
}

/** One utility tariff: workflow, versions, diff, sample bill (F5 5.2). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ tariffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tariffId }, query, context] = await Promise.all([params, searchParams, adminContext()]);
  return <TariffDetail context={context} tariffId={tariffId} searchParams={query} />;
}
