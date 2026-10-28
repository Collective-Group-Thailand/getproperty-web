import { getTranslations } from "next-intl/server";

import { MediaOrderDetail } from "@/features/admin/growth/MediaOrdersView";
import { adminContext } from "@/features/admin/shared/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.listings.tab");
  return { title: t("media") };
}

/** One photo service order: schedule, deliver or cancel (G5, D-297). */
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, context] = await Promise.all([params, adminContext()]);
  return <MediaOrderDetail context={context} orderId={orderId} />;
}
