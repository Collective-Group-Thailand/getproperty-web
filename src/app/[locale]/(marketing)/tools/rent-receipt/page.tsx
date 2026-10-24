import { getTranslations, setRequestLocale } from "next-intl/server";

import { marketingMetadata } from "@/features/owner/marketing/seo";
import { ToolFrame } from "@/features/owner/marketing/tools/ToolFrame";
import { RentReceiptTool } from "@/features/owner/marketing/tools/RentReceiptTool";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.tools.receipt");
  return marketingMetadata("/tools/rent-receipt", locale, { title: t("metaTitle"), description: t("intro") });
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ToolFrame tool="receipt" locale={locale}>
      <RentReceiptTool />
    </ToolFrame>
  );
}
