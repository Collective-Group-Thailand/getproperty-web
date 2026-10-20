import { getTranslations } from "next-intl/server";

import { AdminHome } from "@/features/admin/operations/AdminHome";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.operations.home");
  return { title: t("title") };
}

/** The admin home: the back office's queues (F5). */
export default async function Page() {
  return <AdminHome context={await adminContext()} />;
}
