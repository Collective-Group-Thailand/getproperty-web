import { getTranslations, setRequestLocale } from "next-intl/server";

import { NewListingForm } from "@/features/owner/listings/NewListingForm";
import { ownerPath } from "@/features/owner/shared/links";
import { ownerContext, section } from "@/features/owner/shared/server";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconHome } from "@/ui/icons/glyphs/home";

export async function generateMetadata() {
  const t = await getTranslations("owner.listings.create");
  return { title: t("title") };
}

/** First step of a listing: unit, headline, rent (F6.2, D-252). `?unit=` preselects a unit from the portfolio. */
export default async function NewListing({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { unit } = await searchParams;
  const [context, t] = await Promise.all([ownerContext(), getTranslations("owner.listings.create")]);
  const portfolio = await section(unwrap(context.api.GET("/v1/owner/portfolio")));
  const units = (portfolio.data?.units ?? []).map((u) => ({
    id: u.unitId,
    label: u.kind === "house" || u.kind === "townhouse" ? u.building.name : `${u.building.name} · ${u.unitNo}`,
    defaultRent: u.defaultRent,
  }));
  return (
    <OwnerPage testId="listing-new-page">
      <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
      <div className="max-w-2xl">
        {!portfolio.data ? (
          <SectionError error={portfolio.error} />
        ) : units.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={IconHome}
              title={t("noUnits")}
              action={
                <Button asChild>
                  <a href={ownerPath(locale, "/portfolio/new")}>{t("noUnitsAction")}</a>
                </Button>
              }
            />
          </Card>
        ) : (
          <NewListingForm units={units} initialUnitId={units.some((u) => u.id === unit) ? unit! : null} />
        )}
      </div>
    </OwnerPage>
  );
}
