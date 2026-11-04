import { getTranslations } from "next-intl/server";

import { LISTING_STATUS } from "@/domain/status/listing";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { LinkMenu } from "@/features/shared/console/LinkMenu";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { PhotoPlaceholder } from "@/ui/components/PhotoPlaceholder";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ownerPath } from "../shared/links";
import { param, section, type OwnerContext } from "../shared/server";

type Listing = Schemas["ListingDto"];
const VIEWS = ["all", "published", "pending_review", "draft", "paused", "closed"] as const;
type View = (typeof VIEWS)[number];
/** A view holds these states; `rejected` sits with the drafts (both wait for the owner). */
const VIEW_STATES: Record<Exclude<View, "all">, Listing["state"][]> = {
  published: ["published"],
  pending_review: ["pending_review"],
  draft: ["draft", "rejected"],
  paused: ["paused"],
  closed: ["closed"],
};

/**
 * The owner's listings (F6.2, D-252) as a gallery of cards: the cover photo (or the line drawing of a room), the
 * title on two lines, the address, the rent and the state with its icon; what the owner should know about the
 * listing (why it is in review, hidden after reports) as one amber line inside the card. The whole card opens the
 * editor; its rare links sit behind one "⋯". A dashed tile ends the grid — making a listing from a unit in the
 * portfolio — and is the empty state when there is no listing yet. Views are the API's states over the full list it
 * returns (the list is not paged).
 */
export async function ListingsView({
  context,
  searchParams = {},
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.listings");
  const statusT = await getTranslations("status.listing");
  const { api, locale } = context;
  const [listings, handoffs] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/listings"))),
    // G8 (D-299): units handed over from getbuild — shown only when this tenant claimed one.
    section(unwrap(api.GET("/v1/owner/rental-handoffs"))),
  ]);
  const handoffCount = handoffs.data?.data.length ?? 0;
  const requested = param(searchParams.view);
  const view: View = VIEWS.includes(requested as View) ? (requested as View) : "all";
  const q = (param(searchParams.q) ?? "").trim();
  const all = listings.data ?? [];
  const inView = (key: View) => (key === "all" ? all : all.filter((l) => VIEW_STATES[key].includes(l.state)));
  const needle = q.toLowerCase();
  const shown = inView(view).filter(
    (l) =>
      !needle ||
      [l.titleTh, l.titleEn, l.address, l.district].some((text) => text?.toLowerCase().includes(needle) ?? false),
  );
  const base = ownerPath(locale, "/listings");
  const href = (key: View) => {
    const query = new URLSearchParams();
    if (key !== "all") query.set("view", key);
    if (q) query.set("q", q);
    const text = query.toString();
    return text ? `${base}?${text}` : base;
  };
  const newHref = ownerPath(locale, "/listings/new");

  return (
    <OwnerPage testId="listings">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {handoffCount > 0 ? (
              <Button asChild variant="secondary" iconStart={IconBuilding} data-testid="listing-handoffs">
                <a href={ownerPath(locale, "/listings/handoffs")}>{t("handoffs", { count: handoffCount })}</a>
              </Button>
            ) : null}
            <Button asChild iconStart={IconAdd} data-testid="listing-new">
              <a href={newHref}>{t("new")}</a>
            </Button>
          </>
        }
      />
      {!listings.data ? (
        <SectionError error={listings.error} />
      ) : all.length === 0 ? (
        <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2 xl:grid-cols-3">
          <CreateTile href={newHref} lone t={t} />
        </ul>
      ) : (
        <>
          <ListToolbar
            tabs={
              <ViewTabs
                label={t("views.label")}
                current={view}
                tabs={VIEWS.map((key) => ({
                  key,
                  href: href(key),
                  label: key === "all" ? t("views.all") : key === "draft" ? t("views.draft") : statusT(key),
                  count: inView(key).length,
                  testId: `listings-view-${key}`,
                }))}
              />
            }
            filters={
              <FilterBar
                variant="toolbar"
                fields={[{ name: "q", label: t("views.search"), type: "search", placeholder: t("views.search") }]}
              />
            }
          />
          {shown.length === 0 ? (
            <EmptyState
              variant="card"
              icon={IconSearch}
              title={t("views.emptyTitle")}
              description={t("views.emptyBody")}
              action={
                <Button asChild variant="secondary">
                  <a href={base}>{t("views.clear")}</a>
                </Button>
              }
            />
          ) : (
            <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2 xl:grid-cols-3" data-testid="listing-cards">
              {shown.map((listing) => (
                <ListingCard key={listing.id} listing={listing} locale={locale} t={t} />
              ))}
              {view === "all" && !q ? <CreateTile href={newHref} t={t} /> : null}
            </ul>
          )}
        </>
      )}
    </OwnerPage>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"owner.listings">>>;

/** The dashed tile that ends the grid: a listing starts from a unit of the portfolio. Alone, it is the empty state. */
function CreateTile({ href, lone = false, t }: { href: string; lone?: boolean; t: T }) {
  return (
    <li
      className="rounded-card border-border-strong hover:border-primary hover:bg-surface duration-fast relative flex min-h-72 flex-col items-center justify-center gap-2 border border-dashed px-8 py-10 text-center transition-colors"
      data-testid={lone ? "listings-empty" : "listing-create-tile"}
    >
      <span
        aria-hidden="true"
        className="border-border bg-surface text-primary mb-3 grid size-12 place-items-center rounded-full border text-2xl"
      >
        <Icon icon={IconHome} />
      </span>
      <h2 className="text-base font-semibold text-balance">{lone ? t("empty.title") : t("tile.title")}</h2>
      <p className="text-muted max-w-xs text-sm text-pretty">{lone ? t("empty.description") : t("tile.body")}</p>
      <a
        href={href}
        className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-semibold after:absolute after:inset-0"
      >
        <Icon icon={IconAdd} />
        {lone ? t("empty.action") : t("tile.action")}
      </a>
    </li>
  );
}

/** "28.5 ตร.ม. · 1 ห้องนอน · ชั้น 12" — the facts the API has, nothing invented. */
function factsLine(listing: Listing, locale: Locale, t: T): string {
  return [
    listing.sizeSqm ? t("card.size", { size: formatDecimal(listing.sizeSqm, locale) }) : null,
    listing.bedrooms !== null ? t("card.bedrooms", { count: listing.bedrooms }) : null,
    listing.floorLabel ? t("card.floor", { floor: listing.floorLabel }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ListingCard({ listing, locale, t }: { listing: Listing; locale: Locale; t: T }) {
  const cover = listing.photos[0];
  const href = ownerPath(locale, `/listings/${listing.id}`);
  const live = listing.state === "published" && !listing.hidden;
  const warnings = [
    ...(listing.hidden ? [{ key: "hidden", icon: IconHide, text: t("card.hidden") }] : []),
    ...(listing.reportCount > 0 && !listing.hidden
      ? [{ key: "reports", icon: IconAlert, text: t("card.reports", { count: listing.reportCount }) }]
      : []),
    ...(listing.state === "pending_review"
      ? listing.reviewReasons.map((reason) => ({ key: reason, icon: IconAlert, text: t(`reasons.${reason}`) }))
      : []),
    ...(listing.state === "rejected" ? [{ key: "rejected", icon: IconAlert, text: t("card.rejected") }] : []),
  ];
  const meta = [
    factsLine(listing, locale, t) || null,
    listing.publishedAt
      ? t("card.publishedOn", { date: formatDate(listing.publishedAt, locale) })
      : listing.photos.length === 0
        ? t("card.noPhoto")
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card
      as="li"
      padding="none"
      interactive
      className="relative flex flex-col"
      data-testid="listing-card"
      data-state={listing.state}
    >
      <div className="p-3 pb-0">
        <div className="rounded-control relative aspect-[16/10] overflow-hidden">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed object-storage preview, not a static asset
            <img src={cover.url} alt="" className="bg-bg-subtle size-full object-cover" loading="lazy" />
          ) : (
            <PhotoPlaceholder className="rounded-control size-full" />
          )}
          {listing.photos.length > 0 ? (
            <span className="rounded-thumb bg-surface/95 text-fg shadow-card absolute end-2.5 bottom-2.5 inline-flex h-6 items-center gap-1 px-2 text-xs font-medium tabular-nums">
              <Icon icon={IconCamera} />
              {t("card.photos", { count: listing.photos.length })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="line-clamp-2 text-base leading-snug font-semibold text-balance">
              <a href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
                {listing.titleTh}
              </a>
            </h2>
            {listing.address || listing.district ? (
              <p className="text-muted truncate text-sm">{listing.address ?? listing.district}</p>
            ) : null}
          </div>
          <div className="relative z-10 -me-1 -mt-1 shrink-0">
            <LinkMenu
              label={t("card.more", { title: listing.titleTh })}
              items={[
                { id: "edit", label: t("card.edit"), href, icon: IconEdit },
                ...(live
                  ? [
                      {
                        id: "view",
                        label: t("editor.view"),
                        href: ownerPath(locale, `/rent/${listing.slug}`),
                        icon: IconExternal,
                      },
                      {
                        id: "broadcast",
                        label: t("card.broadcast"),
                        href: ownerPath(locale, `/promote/broadcasts/new?listing=${listing.id}`),
                        icon: IconMegaphone,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </div>
        {warnings.length ? (
          <div className="flex flex-col gap-1.5">
            {warnings.map((warning) => (
              <Callout key={warning.key} tone="warning" size="sm" live={false} icon={warning.icon}>
                {warning.text}
              </Callout>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3">
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadgeOf map={LISTING_STATUS} value={listing.state} size="sm" />
            {listing.verifiedOwner ? (
              <Icon icon={IconShield} className="text-primary" label={t("verification.verified")} />
            ) : null}
          </span>
          <span className="text-end whitespace-nowrap">
            <span className="text-lg font-semibold tabular-nums">
              {formatTHB(listing.rent, locale, { decimals: 0 })}
            </span>
            <span className="text-muted text-sm">{t("card.perMonth")}</span>
          </span>
        </div>
        {meta ? <p className="border-border text-muted m-0 border-t pt-3 text-sm">{meta}</p> : null}
      </div>
    </Card>
  );
}
