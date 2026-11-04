import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { MEDIA_SERVICE_STATUS, MEDIA_SERVICE_VALUES } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { isApiError } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { FactGrid } from "@/ui/components/FactGrid";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCamera } from "@/ui/icons/glyphs/camera";

import { StateTabs } from "../shared/lists";
import { NotAllowed } from "../shared/NotAllowed";
import { can, enumParam, pageParam, param, section, withQuery, type AdminContext } from "../shared/server";
import { CancelMediaOrder, DeliverMedia, ScheduleMediaVisit } from "./MediaOrderActions";

type SearchParams = Record<string, string | string[] | undefined>;
type Order = Schemas["AdminMediaServiceOrderDto"];

/** What the platform team does next with an order, in words. */
async function nextStep(order: Order, locale: AdminContext["locale"]): Promise<string> {
  const t = await getTranslations("admin.growth.media.next");
  switch (order.state) {
    case "pending_payment":
      return t("pending_payment");
    case "requested":
      return t("requested");
    case "scheduled":
      return order.scheduledFor ? t("scheduled", { date: formatDateTime(order.scheduledFor, locale) }) : t("requested");
    case "delivered":
      return t("delivered", { count: order.deliverableDocumentIds.length });
    case "cancelled":
      return t("cancelled", { reason: order.cancelReason ?? "—" });
  }
}

/**
 * Listings › Photo services (G5, D-297, O-032): verified photo / 360° orders of every tenant, newest first, by state
 * — paid ones wait for the platform team to book the partner. A row opens the order.
 */
export async function MediaOrdersView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.growth.media");
  const listings = await getTranslations("admin.listings");
  const status = await getTranslations("status.mediaService");
  const { api, locale, me } = context;
  if (!can(me, "admin.listing.verify")) return <NotAllowed context={context} />;
  const q = param(searchParams.q);
  const state = enumParam(searchParams.state, MEDIA_SERVICE_VALUES);
  const list = await section(
    unwrap(
      api.GET("/v1/admin/media-service-orders", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q,
            state,
          },
        },
      }),
    ),
  );
  const rows = list.data
    ? await Promise.all(list.data.data.map(async (order) => ({ order, next: await nextStep(order, locale) })))
    : [];
  return (
    <ConsolePage testId="admin-media-orders">
      <PageHeader title={listings("tab.media")} description={t("intro")} />
      <ListToolbar
        tabs={
          <StateTabs
            states={MEDIA_SERVICE_VALUES}
            current={state}
            total={(one) =>
              unwrap(api.GET("/v1/admin/media-service-orders", { params: { query: { perPage: 1, q, state: one } } }))
            }
            href={(one) => withQuery("/listings/media", { q, state: one })}
            label={(one) => status(one)}
            allLabel={t("all")}
            navLabel={t("state")}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCamera}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={q || state ? "/listings/media" : "/listings"}>{q || state ? t("clear") : t("openListings")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={listings("tab.media")}
            testId="media-orders"
            stackOnPhones
            minWidth="60rem"
            columns={[
              { key: "order", header: t("col.order"), phone: "title" },
              { key: "tenant", header: t("col.tenant"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
              { key: "next", header: t("col.next"), phone: "meta" },
              { key: "price", header: t("col.price"), align: "end", phone: "figure" },
            ]}
            rows={rows.map(({ order, next }) => ({
              key: order.id,
              href: `/listings/media/${order.id}`,
              testId: "media-order-row",
              data: { state: order.state, id: order.id },
              cells: {
                order: (
                  <span className="flex flex-col">
                    <span className="font-semibold">{order.name}</span>
                    <span className="text-muted text-sm font-normal">
                      {[order.listingTitle, t("unit", { unit: order.unitNo })].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                ),
                tenant: order.tenantName,
                state: <StatusBadgeOf map={MEDIA_SERVICE_STATUS} value={order.state} size="sm" />,
                next: <span className="text-sm">{next}</span>,
                price: <span className="whitespace-nowrap tabular-nums">{formatTHB(order.price, locale)}</span>,
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path="/listings/media" searchParams={searchParams} locale={locale} />
        </>
      )}
    </ConsolePage>
  );
}

/** A Bangkok wall-clock value for `<input type="datetime-local">` (tomorrow 10:00 when the visit is not set yet). */
function wallClock(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${iso ? `${get("hour")}:${get("minute")}` : "10:00"}`;
}

/**
 * One photo service order (G5): who ordered what for which listing / unit, the price and its invoice, the owner's
 * note, the partner's reference and visit, the delivered files; the next step by state — schedule (requested /
 * scheduled), upload and deliver, or cancel with a reason (money back only by a credit note through Finance).
 */
export async function MediaOrderDetail({ context, orderId }: { context: AdminContext; orderId: string }) {
  const t = await getTranslations("admin.growth.media");
  const listings = await getTranslations("admin.listings");
  const { api, locale, me } = context;
  if (!can(me, "admin.listing.verify")) return <NotAllowed context={context} />;
  const result = await section(
    unwrap(api.GET("/v1/admin/media-service-orders/{orderId}", { params: { path: { orderId } } })),
  );
  if (!result.data) {
    if (isApiError(result.error) && result.error.status === 404) notFound();
    return (
      <ConsolePage>
        <SectionError error={result.error} />
      </ConsolePage>
    );
  }
  const order = result.data;
  const open = order.state === "requested" || order.state === "scheduled";
  const cancellable = order.state !== "delivered" && order.state !== "cancelled";
  const next = await nextStep(order, locale);
  return (
    <ConsolePage testId="admin-media-order">
      <PageHeader
        title={order.name}
        description={[order.listingTitle, t("unit", { unit: order.unitNo }), order.tenantName]
          .filter(Boolean)
          .join(" · ")}
        status={<StatusBadgeOf map={MEDIA_SERVICE_STATUS} value={order.state} />}
        crumbs={[{ label: listings("tab.media"), href: "/listings/media" }, { label: order.name }]}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={open ? t("visitTitle") : t("panelTitle")}
            testId="media-order-panel"
            description={<span data-testid="media-order-next">{next}</span>}
            facts={[
              { key: "price", label: t("col.price"), value: formatTHB(order.price, locale) },
              {
                key: "visit",
                label: t("when"),
                value: order.scheduledFor ? formatDateTime(order.scheduledFor, locale) : "—",
              },
            ]}
            primary={
              open ? <ScheduleMediaVisit order={order} defaultWhen={wallClock(order.scheduledFor)} /> : undefined
            }
            destructive={cancellable ? <CancelMediaOrder order={order} /> : undefined}
          />
        }
      >
        {order.state === "pending_payment" ? <Callout tone="warning">{t("waitPayment")}</Callout> : null}
        {order.state === "delivered" ? (
          <Callout tone="success" title={t("deliveredTitle", { count: order.deliverableDocumentIds.length })}>
            {order.deliveredAt ? t("deliveredAt", { date: formatDateTime(order.deliveredAt, locale) }) : null}
          </Callout>
        ) : null}
        {order.state === "cancelled" ? (
          <Callout tone="neutral" title={t("cancelledTitle")}>
            {order.cancelReason}
          </Callout>
        ) : null}
        <Card as="section" aria-labelledby="media-order-facts">
          <CardHeader title={<span id="media-order-facts">{t("facts")}</span>} />
          <FactGrid
            label={t("facts")}
            facts={[
              {
                key: "tenant",
                label: t("col.tenant"),
                value: (
                  <a href={`/tenants/${order.tenantId}`} className="hover:underline">
                    {order.tenantName}
                  </a>
                ),
              },
              { key: "unit", label: t("unitLabel"), value: order.unitNo },
              {
                key: "invoice",
                label: t("invoice"),
                value: order.invoice ? (
                  <a href={`/subscriptions/invoices/${order.invoice.id}`} className="font-mono hover:underline">
                    {order.invoice.number}
                  </a>
                ) : (
                  "—"
                ),
              },
              { key: "ordered", label: t("ordered"), value: formatDateTime(order.createdAt, locale) },
              {
                key: "paid",
                label: t("paid"),
                value: order.requestedAt ? formatDateTime(order.requestedAt, locale) : "—",
              },
              { key: "partner", label: t("partnerRef"), value: order.partnerRef ?? "—" },
            ]}
          />
          {order.note ? (
            <div className="mt-4 flex flex-col gap-1">
              <span className="text-muted text-sm">{t("ownerNote")}</span>
              <p className="m-0 max-w-prose">{order.note}</p>
            </div>
          ) : null}
        </Card>
        {open ? (
          <Card as="section" aria-labelledby="media-order-deliver" className="flex flex-col gap-4">
            <CardHeader
              title={<span id="media-order-deliver">{t("deliverTitle")}</span>}
              description={t("deliverIntro")}
            />
            <DeliverMedia order={order} />
          </Card>
        ) : null}
      </DetailLayout>
    </ConsolePage>
  );
}
