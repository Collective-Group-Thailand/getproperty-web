import { getTranslations, setRequestLocale } from "next-intl/server";

import { AddUnitForm } from "@/features/owner/portfolio/AddUnitForm";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.portfolio.form");
  return { title: t("title") };
}

/** Add a unit to the portfolio in one screen (B7.1, F6.1, D-251). */
export default async function AddPortfolioUnit({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner");
  return (
    <OwnerPage testId="portfolio-new">
      <PageHeader
        title={t("portfolio.form.title")}
        description={t("portfolio.form.description")}
        crumbs={[{ label: t("portfolio.form.title") }]}
      />
      <div className="max-w-3xl">
        <AddUnitForm />
      </div>
    </OwnerPage>
  );
}
