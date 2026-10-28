import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { BoostOffer, BoostRow, MediaOffer, MediaOrderRow } from "./GrowthRows";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES = ["active", "pending_payment", "expired"] as const;
type StateTab = (typeof STATES)[number] | "all";

/**
 * Promotion (G5, D-297, D-298): every boost the tenant bought — listing and building — by state with its window and
 * invoice, the **building boost** for each building it runs (free where the API says so, otherwise its price or "not
 * on sale yet", O-027), the listing boosts and photo services on offer (bought from a listing's page) and the photo
 * orders. Every purchase is an invoice on the subscription page; nothing is pre-paid or kept as credit.
 */
export async function PromotionView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.growth");
  const { api, locale, me, buildings } = context;
  const menu = new Set(me.menu);
  if (!menu.has("listings") && !menu.has("buildings")) notFound();
  const raw = param(searchParams.state);
  const tab: StateTab = STATES.includes(raw as (typeof STATES)[number]) ? (raw as StateTab) : "all";
  const [products, boosts, media, orders] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/boost-products"))),
    section(unwrap(api.GET("/v1/owner/boosts"))),
    section(unwrap(api.GET("/v1/owner/media-service-products"))),
    section(unwrap(api.GET("/v1/owner/media-service-orders"))),
  ]);
  const canBuy = ownerCan(me, "tenant.subscription.manage") && !readOnly(me);
  const all = boosts.data?.data ?? [];
  const shown = tab === "all" ? all : all.filter((boost) => boost.state === tab);
  const buildingProducts = products.data?.products.filter((product) => product.target === "building") ?? [];
  const listingProducts = products.data?.products.filter((product) => product.target === "listing") ?? [];
  const runBuildings = buildings.filter((building) => building.access !== "grant");
  const base = ownerPath(locale, "/promote");
  const pendingFor = (product: Schemas["BoostProductDto"], buildingId: string) =>
    all.find((b) => b.buildingId === buildingId && b.productId === product.id && b.state === "pending_payment") ?? null;

  return (
    <OwnerPage testId="promotion">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        crumbs={[{ label: t("page.title") }]}
        actions={
          menu.has("listings") ? (
            <Button asChild variant="secondary" iconStart={IconMegaphone}>
              <a href={ownerPath(locale, "/listings")} data-testid="promotion-listings">
                {t("page.toListings")}
              </a>
            </Button>
          ) : null
        }
      />
      <Callout tone="info">{t("noWallet")}</Callout>

      <Card as="section" aria-labelledby="promotion-boosts" className="flex flex-col gap-4">
        <CardHeader title={<span id="promotion-boosts">{t("boost.mine")}</span>} description={t("boost.mineHint")} />
        <LinkTabs
          label={t("boost.mine")}
          current={tab === "all" ? base : `${base}?state=${tab}`}
          tabs={(["all", ...STATES] as StateTab[]).map((one) => ({
            href: one === "all" ? base : `${base}?state=${one}`,
            label: t(`boost.tabs.${one}`),
            testId: `promotion-tab-${one}`,
          }))}
        />
        {!boosts.data ? (
          <SectionError error={boosts.error} />
        ) : shown.length === 0 ? (
          <EmptyState icon={IconMegaphone} title={t(`boost.empty.${tab}`)} description={t("boost.emptyHint")} />
        ) : (
          <ul className="divide-border m-0 list-none divide-y p-0" data-testid="promotion-boosts">
            {shown.map((boost) => (
              <BoostRow key={boost.id} boost={boost} locale={locale} />
            ))}
          </ul>
        )}
      </Card>

      {runBuildings.length > 0 && buildingProducts.length > 0 ? (
        <Card as="section" aria-labelledby="promotion-building" className="flex flex-col gap-4" id="building-boost">
          <CardHeader
            title={<span id="promotion-building">{t("boost.buildingTitle")}</span>}
            description={t("boost.buildingHint")}
          />
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3" data-testid="building-boosts">
            {runBuildings.flatMap((building) =>
              buildingProducts.map((product) => (
                <BoostOffer
                  key={`${building.id}-${product.id}`}
                  heading={building.name}
                  product={product}
                  target={{ id: building.id, name: building.name }}
                  locale={locale}
                  canBuy={canBuy}
                  pending={pendingFor(product, building.id)}
                />
              )),
            )}
          </ul>
        </Card>
      ) : null}

      {menu.has("listings") ? (
        <Card as="section" aria-labelledby="promotion-listing" className="flex flex-col gap-4">
          <CardHeader
            title={<span id="promotion-listing">{t("boost.listingTitle")}</span>}
            description={t("boost.listingHint")}
          />
          {!products.data ? (
            <SectionError error={products.error} />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {listingProducts.map((product) => (
                <BoostOffer
                  key={product.id}
                  product={product}
                  target={null}
                  locale={locale}
                  canBuy={false}
                  pending={null}
                />
              ))}
            </ul>
          )}
          <p className="text-muted m-0 text-xs">{t("boost.howRanked")}</p>
        </Card>
      ) : null}

      {menu.has("listings") ? (
        <Card as="section" aria-labelledby="promotion-media" className="flex flex-col gap-4">
          <CardHeader title={<span id="promotion-media">{t("media.title")}</span>} description={t("media.pageHint")} />
          {!media.data ? (
            <SectionError error={media.error} />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {media.data.products.map((product) => (
                <MediaOffer
                  key={product.id}
                  product={product}
                  listing={null}
                  locale={locale}
                  canBuy={false}
                  open={null}
                />
              ))}
            </ul>
          )}
          <h3 className="text-sm font-semibold">{t("media.orders")}</h3>
          {!orders.data ? (
            <SectionError error={orders.error} />
          ) : orders.data.data.length === 0 ? (
            <EmptyState icon={IconCamera} title={t("media.empty")} description={t("media.emptyHint")} />
          ) : (
            <ul className="divide-border m-0 list-none divide-y p-0" data-testid="promotion-media-orders">
              {orders.data.data.map((order) => (
                <MediaOrderRow key={order.id} order={order} locale={locale} />
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </OwnerPage>
  );
}
