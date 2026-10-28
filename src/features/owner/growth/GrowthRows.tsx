import { getTranslations } from "next-intl/server";

import { MEDIA_SERVICE_STATUS, STORAGE_PACKAGE_STATUS } from "@/domain/status";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

import { ownerPath } from "../shared/links";
import { BuyBoost, OrderMediaService } from "./GrowthActions";

type Translator = Awaited<ReturnType<typeof getTranslations<"owner.growth">>>;

/** "7 วัน" / "1 เดือน" from a boost product or a bought boost. */
export function durationOf(t: Translator, item: { days: number | null; months: number | null }): string {
  return item.days ? t("duration.days", { count: item.days }) : t("duration.months", { count: item.months ?? 1 });
}

const nameOf = (locale: Locale, product: { nameTh: string; nameEn: string }) =>
  locale === "th" ? product.nameTh : product.nameEn;

/** A price from the API, "incl. VAT" first; "not on sale yet" while the platform has published none (O-027). */
async function PriceOrUnpriced({
  product,
  locale,
  free,
}: {
  product: { onSale: boolean; price: string | null; total: string | null };
  locale: Locale;
  free?: boolean;
}) {
  const t = await getTranslations("owner.growth");
  if (free)
    return (
      <span className="flex flex-col gap-1" data-testid="growth-free">
        <span>
          <Badge tone="success" size="sm">
            {t("free")}
          </Badge>
        </span>
        <span className="text-muted text-sm">{t("freeHint")}</span>
      </span>
    );
  if (product.onSale && product.total && product.price)
    return (
      <span className="flex flex-col" data-testid="growth-price">
        <span className="text-xl font-semibold tabular-nums">{formatTHB(product.total, locale)}</span>
        <span className="text-muted text-xs tabular-nums">
          {t("priceVat", { price: formatTHB(product.price, locale) })}
        </span>
      </span>
    );
  return (
    <span className="flex flex-col gap-1" data-testid="growth-unpriced">
      <span>
        <Badge tone="neutral" size="sm">
          {t("unpriced")}
        </Badge>
      </span>
      <span className="text-muted text-sm">{t("unpricedHint")}</span>
    </span>
  );
}

/**
 * One boost product as an offer tile (G5): name, duration, the API's price incl. VAT — or "not on sale yet" / free —
 * and the buy button when the member may buy and nothing of the same product waits for payment on the target.
 */
export async function BoostOffer({
  product,
  target,
  locale,
  canBuy,
  pending,
  heading,
}: {
  /** Shown above the product name (the building a building boost is for). */
  heading?: string;
  product: Schemas["BoostProductDto"];
  target: { id: string; name: string } | null;
  locale: Locale;
  canBuy: boolean;
  pending: Schemas["BoostDto"] | null;
}) {
  const t = await getTranslations("owner.growth");
  const name = nameOf(locale, product);
  const duration = durationOf(t, product);
  const buyable = product.free || (product.onSale && product.total);
  return (
    <li
      className="rounded-card border-border flex flex-col gap-3 border p-4"
      data-testid="boost-offer"
      data-key={product.key}
      data-on-sale={product.onSale}
    >
      <span className="flex flex-col gap-0.5">
        {heading ? <span className="font-semibold">{heading}</span> : null}
        <span className={heading ? "text-muted text-sm" : "font-semibold"}>{name}</span>
        <span className="text-muted text-sm">{duration}</span>
      </span>
      <PriceOrUnpriced product={product} locale={locale} free={product.free} />
      {pending ? (
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone="warning" size="sm">
            {t("boost.pendingBadge")}
          </Badge>
          {pending.invoice ? (
            <a
              href={ownerPath(locale, `/subscription/invoices/${pending.invoice.id}`)}
              className="text-primary text-sm font-medium hover:underline"
            >
              {t("invoice", { number: pending.invoice.number })}
            </a>
          ) : null}
        </span>
      ) : canBuy && target && buyable ? (
        <span>
          <BuyBoost
            target={product.target}
            targetId={target.id}
            targetName={target.name}
            productId={product.id}
            name={name}
            duration={duration}
            total={product.total ? formatTHB(product.total, locale) : null}
            free={product.free}
            testId={`boost-buy-${product.key}`}
          />
        </span>
      ) : null}
    </li>
  );
}

/** A media service as an offer tile (G5): the same price / not-on-sale rule; ordered for one listing. */
export async function MediaOffer({
  product,
  listing,
  locale,
  canBuy,
  open,
}: {
  product: Schemas["MediaServiceProductDto"];
  listing: { id: string; title: string } | null;
  locale: Locale;
  canBuy: boolean;
  open: Schemas["MediaServiceOrderDto"] | null;
}) {
  const t = await getTranslations("owner.growth");
  const name = nameOf(locale, product);
  return (
    <li
      className="rounded-card border-border flex flex-col gap-3 border p-4"
      data-testid="media-offer"
      data-key={product.key}
      data-on-sale={product.onSale}
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{name}</span>
        <span className="text-muted text-sm">{t(`media.what.${product.service}`)}</span>
      </span>
      <PriceOrUnpriced product={product} locale={locale} />
      {open ? (
        <span>
          <StatusBadgeOf map={MEDIA_SERVICE_STATUS} value={open.state} size="sm" />
        </span>
      ) : canBuy && listing && product.onSale && product.total ? (
        <span>
          <OrderMediaService
            listingId={listing.id}
            listingTitle={listing.title}
            service={product.service}
            name={name}
            total={formatTHB(product.total, locale)}
          />
        </span>
      ) : null}
    </li>
  );
}

/** A running boost whose window starts later: queued after another boost of the same target. */
function queued(boost: Schemas["BoostDto"], now = Date.now()): boolean {
  return boost.state === "active" && boost.startsAt !== null && Date.parse(boost.startsAt) > now;
}

/** A bought boost: what, for which listing / building, its state and window, the price and its invoice. */
export async function BoostRow({ boost, locale }: { boost: Schemas["BoostDto"]; locale: Locale }) {
  const t = await getTranslations("owner.growth");
  const upcoming = queued(boost);
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3"
      data-testid="boost-row"
      data-state={boost.state}
      data-target={boost.target}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{boost.name}</span>
          <StatusBadgeOf map={STORAGE_PACKAGE_STATUS} value={boost.state} size="sm" />
          {upcoming ? (
            <Badge tone="info" size="sm">
              {t("boost.queued")}
            </Badge>
          ) : null}
        </span>
        <span className="text-muted text-sm">
          {t(`boost.target.${boost.target}`, { name: boost.targetName })} · {durationOf(t, boost)}
        </span>
        <span className="text-muted text-sm tabular-nums" data-testid="boost-window">
          {boost.startsAt && boost.endsAt
            ? t("boost.window", {
                from: formatDateTime(boost.startsAt, locale),
                to: formatDateTime(boost.endsAt, locale),
              })
            : boost.state === "pending_payment"
              ? t("boost.waiting")
              : null}
        </span>
      </span>
      <span className="flex flex-col items-start gap-1 text-sm sm:items-end">
        <span className="font-semibold tabular-nums">{boost.free ? t("free") : formatTHB(boost.price, locale)}</span>
        {boost.invoice ? (
          <a
            href={ownerPath(locale, `/subscription/invoices/${boost.invoice.id}`)}
            className="text-primary font-medium hover:underline"
            data-testid="boost-invoice"
          >
            {t("invoice", { number: boost.invoice.number })}
          </a>
        ) : null}
      </span>
    </li>
  );
}

/** A media order: the service, the listing / unit, state, the visit, files delivered, price and invoice. */
export async function MediaOrderRow({ order, locale }: { order: Schemas["MediaServiceOrderDto"]; locale: Locale }) {
  const t = await getTranslations("owner.growth");
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3"
      data-testid="media-order-row"
      data-state={order.state}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{order.name}</span>
          <StatusBadgeOf map={MEDIA_SERVICE_STATUS} value={order.state} size="sm" />
        </span>
        <span className="text-muted text-sm">
          {[order.listingTitle, t("media.unit", { unit: order.unitNo })].filter(Boolean).join(" · ")}
        </span>
        <span className="text-muted text-sm" data-testid="media-order-progress">
          {order.state === "pending_payment"
            ? t("media.waitingPayment")
            : order.state === "requested"
              ? t("media.waitingBooking")
              : order.state === "scheduled" && order.scheduledFor
                ? t("media.visit", { date: formatDateTime(order.scheduledFor, locale) })
                : order.state === "delivered"
                  ? t("media.delivered", { count: order.deliverableDocumentIds.length })
                  : order.state === "cancelled"
                    ? t("media.cancelled", { reason: order.cancelReason ?? "—" })
                    : null}
        </span>
        {order.note ? <span className="text-muted text-xs">{t("media.yourNote", { note: order.note })}</span> : null}
      </span>
      <span className="flex flex-col items-start gap-1 text-sm sm:items-end">
        <span className="font-semibold tabular-nums">{formatTHB(order.price, locale)}</span>
        {order.invoice ? (
          <a
            href={ownerPath(locale, `/subscription/invoices/${order.invoice.id}`)}
            className="text-primary font-medium hover:underline"
          >
            {t("invoice", { number: order.invoice.number })}
          </a>
        ) : null}
      </span>
    </li>
  );
}
