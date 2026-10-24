import { getTranslations, setRequestLocale } from "next-intl/server";

import { marketingMetadata } from "@/features/owner/marketing/seo";
import { ToolFrame } from "@/features/owner/marketing/tools/ToolFrame";
import { UtilityBillTool } from "@/features/owner/marketing/tools/UtilityBillTool";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.tools.utility");
  return marketingMetadata("/tools/utility-bill", locale, { title: t("metaTitle"), description: t("intro") });
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ToolFrame tool="utility" locale={locale}>
      <UtilityBillTool />
    </ToolFrame>
  );
}
