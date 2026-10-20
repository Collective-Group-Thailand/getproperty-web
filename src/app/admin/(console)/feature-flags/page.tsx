import { getTranslations } from "next-intl/server";

import { FlagsView } from "@/features/admin/platform/FlagsView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("feature_flags") };
}

/** Feature flags: defaults, rollout and per-tenant overrides (F5 5.2). */
export default async function Page() {
  return <FlagsView context={await adminContext()} />;
}
