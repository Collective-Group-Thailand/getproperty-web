import { getTranslations } from "next-intl/server";

import { IngestView } from "@/features/admin/fleet/IngestView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("ingest_dead_letters") };
}

/** Refused telemetry with replay (F5 5.3). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <IngestView context={await adminContext()} searchParams={await searchParams} />;
}
