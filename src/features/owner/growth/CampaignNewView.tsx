import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { publicListingAreas } from "@/features/owner/marketing/publicApi";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { ProductCard } from "./BroadcastParts";
import { CampaignBuilder, type BuilderArea, type BuilderListing } from "./CampaignBuilder";

/**
 * New sponsored campaign (G6, D-300): the product's state (drafting works while it is off or unpriced), then the
 * builder over my published, visible listings and the public areas (the slugs the API's segment accepts). With no
 * published listing there is nothing to send: an empty state points to the listings.
 */
export async function CampaignNewView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.broadcast");
  const growth = await getTranslations("owner.growth");
  const { api, locale, me } = context;
  if (!ownerCan(me, "listing.read")) notFound();
  const [product, listings, areas] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/sponsored-campaigns/product"))),
    section(unwrap(api.GET("/v1/owner/listings", { params: { query: { state: "published" } } }))),
    publicListingAreas(),
  ]);
  const live: BuilderListing[] = (listings.data ?? [])
    .filter((listing) => listing.state === "published" && !listing.hidden)
    .map((listing) => ({
      id: listing.id,
      title: (locale === "en" && listing.titleEn) || listing.titleTh,
      rent: formatTHB(listing.rent, locale, { decimals: 0 }),
      place: listing.transit?.name ?? listing.district,
      kind: listing.unitKind,
    }));
  const areaOptions: BuilderArea[] = areas.map((area) => ({
    slug: area.slug,
    label: locale === "en" ? area.nameEn : area.name,
    count: area.count,
  }));
  const canSave = ownerCan(me, "tenant.subscription.manage") && !readOnly(me);

  return (
    <OwnerPage testId="campaign-new">
      <PageHeader
        title={t("builder.title")}
        description={t("builder.description")}
        crumbs={[
          { label: growth("page.title"), href: ownerPath(locale, "/promote") },
          { label: t("tabs.broadcasts"), href: ownerPath(locale, "/promote/broadcasts") },
          { label: t("builder.title") },
        ]}
      />
      {!product.data ? (
        <SectionError error={product.error} />
      ) : !listings.data ? (
        <SectionError error={listings.error} />
      ) : live.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconMegaphone}
            title={t("builder.noListings")}
            description={t("builder.noListingsHint")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/listings")}>{t("builder.toListings")}</a>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ProductCard product={product.data} locale={locale} compact />
          <CampaignBuilder
            product={product.data}
            listings={live}
            areas={areaOptions}
            preselect={param(searchParams.listing) ?? null}
            canSave={canSave}
          />
        </>
      )}
    </OwnerPage>
  );
}
