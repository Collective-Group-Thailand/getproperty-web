import { getTranslations, setRequestLocale } from "next-intl/server";

import { marketingMetadata } from "@/features/owner/marketing/seo";
import { ToolFrame } from "@/features/owner/marketing/tools/ToolFrame";
import { RentalYieldTool } from "@/features/owner/marketing/tools/RentalYieldTool";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.tools.yield");
  return marketingMetadata("/tools/rental-yield", locale, { title: t("metaTitle"), description: t("intro") });
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ToolFrame tool="yield" locale={locale}>
      <RentalYieldTool />
    </ToolFrame>
  );
}
