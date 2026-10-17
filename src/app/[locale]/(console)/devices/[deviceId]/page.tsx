import { getTranslations, setRequestLocale } from "next-intl/server";

import { DeviceDetail } from "@/features/owner/metering/DevicesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("devices") };
}

/** One device (F2 2.5). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; deviceId: string }> }) {
  const { locale, deviceId } = await params;
  setRequestLocale(locale);
  return <DeviceDetail context={await ownerContext()} deviceId={deviceId} />;
}
