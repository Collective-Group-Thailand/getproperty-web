import { getTranslations } from "next-intl/server";

import { PlatformUsersView } from "@/features/admin/operations/PlatformUsersView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("platform_users") };
}

/** Collective staff and their platform roles (D-090). */
export default async function Page() {
  return <PlatformUsersView context={await adminContext()} />;
}
