import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CO_BROKE_STATUS, MANDATE_STATUS } from "@/domain/status/mandate";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDecimal, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconPercent } from "@/ui/icons/glyphs/percent";
import { IconSwap } from "@/ui/icons/glyphs/swap";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { CoBrokeAction, ProposeCoBroke } from "./CoBrokeActions";
import { commissionText, validityText } from "./MandatesView";

const LISTING_STATES = ["draft", "pending_review", "published", "paused", "rejected", "closed"];

/**
 * An agency's granted portfolio (G2, D-293): the units owners mandated to it — and only those — with scope,
 * exclusivity, validity and the agency's listing of each.
 */
export async function MandatedUnitsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.agency");
  const { api, locale } = context;
  const units = await section(unwrap(api.GET("/v1/owner/mandated-units")));
  return (
    <OwnerPage testId="mandated-units">
      <PageHeader title={t("units.title")} description={t("units.description")} />
      {param(searchParams.welcome) ? (
        <Callout tone="success">
          <span data-testid="agency-welcome">{t("units.welcome")}</span>
        </Callout>
      ) : null}
      {!units.data ? (
        <SectionError error={units.error} />
      ) : units.data.data.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={IconKey}
            title={t("units.empty")}
            description={t("units.emptyHint")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/mandates?view=invited")}>{t("units.inbox")}</a>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" data-testid="mandated-unit-rows">
          {units.data.data.map((unit) => (
            <Card
              as="li"
              key={unit.unitId}
              className="flex flex-col gap-3"
              data-testid="mandated-unit"
              data-unit-no={unit.unitNo}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex flex-col">
                  <span className="font-semibold">{t("mandates.unit", { unitNo: unit.unitNo })}</span>
                  <span className="text-muted text-sm">
                    {[unit.buildingName, unit.district, unit.province].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  <StatusBadgeOf map={MANDATE_STATUS} value={unit.mandate.state} size="sm" />
                  {unit.mandate.exclusive ? (
                    <Badge tone="primary" size="sm">
                      {t("exclusive")}
                    </Badge>
                  ) : null}
                </span>
              </div>
              <span className="text-sm">
                {t("mandates.owner", { name: unit.mandate.ownerName })} · {t(`scope.${unit.mandate.scope}`)}
                {unit.areaSqm ? ` · ${t("units.area", { area: formatDecimal(unit.areaSqm, locale) })}` : ""}
              </span>
              <span className="text-muted text-sm">
                {commissionText(t, unit.mandate, locale)} ·{" "}
                {validityText(t, unit.mandate.validFrom, unit.mandate.validTo, locale)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {unit.listing ? (
                  <>
                    <Badge tone="info" size="sm">
                      {t("units.listing", {
                        state: LISTING_STATES.includes(unit.listing.state)
                          ? t(`listingState.${unit.listing.state}`)
                          : unit.listing.state,
                      })}
                    </Badge>
                    <Button asChild size="sm" variant="ghost" iconStart={IconMegaphone}>
                      <a href={ownerPath(locale, `/listings/${unit.listing.id}`)}>{t("units.openListing")}</a>
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-muted text-sm">{t("units.noListing")}</span>
                    <Button asChild size="sm" variant="secondary" iconStart={IconMegaphone}>
                      <a href={ownerPath(locale, `/listings/new?unit=${unit.unitId}`)} data-testid="mandated-list-it">
                        {t("units.listIt")}
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </OwnerPage>
  );
}

/** Co-broke agreements (G2, D-293 (6)): proposed by the listing agency, signed in-app by the co-agency. */
export async function CoBrokeView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.agency");
  const { api, locale, me } = context;
  const canManage = !readOnly(me) && ownerCan(me, "listing.manage");
  const [agreements, units, agencies] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/co-broke-agreements"))),
    section(unwrap(api.GET("/v1/owner/mandated-units"))),
    ownerCan(me, "tenant.grant.manage")
      ? section(unwrap(api.GET("/v1/owner/agencies")))
      : Promise.resolve({ data: { data: [] }, error: null }),
  ]);
  const tenantId = me.currentTenant?.id;
  const listings = (units.data?.data ?? []).flatMap((u) =>
    u.listing && u.mandate.state === "active"
      ? [{ id: u.listing.id, label: `${t("mandates.unit", { unitNo: u.unitNo })} · ${u.buildingName}` }]
      : [],
  );
  const all = agreements.data?.data ?? [];
  const mine = all.filter((a) => a.listingAgencyTenantId === tenantId);
  const invited = all.filter((a) => a.coAgencyTenantId === tenantId);

  const table = (rows: Schemas["CoBrokeDto"][], asListing: boolean, testId: string) =>
    rows.length === 0 ? (
      <EmptyState icon={IconSwap} title={t("coBroke.empty")} />
    ) : (
      <SimpleTable
        caption={asListing ? t("coBroke.asListing") : t("coBroke.asCo")}
        testId={testId}
        minWidth="44rem"
        columns={[
          { key: "listing", header: t("coBroke.fields.listing") },
          { key: "split", header: t("coBroke.fields.split"), align: "end" },
          { key: "validity", header: t("columns.validity") },
          { key: "state", header: t("columns.state") },
          { key: "actions", header: <span className="sr-only">{t("columns.actions")}</span>, align: "end" },
        ]}
        rows={rows.map((a) => {
          const partner = asListing ? a.coAgencyName : a.listingAgencyName;
          return {
            key: a.id,
            testId: "co-broke-row",
            data: { state: a.state },
            cells: {
              listing: (
                <span className="flex flex-col">
                  <span className="font-medium">{t("coBroke.listing", { slug: a.listingSlug })}</span>
                  <span className="text-muted text-xs">
                    {asListing ? t("coBroke.with", { name: partner }) : t("coBroke.from", { name: partner })}
                  </span>
                  {a.note ? <span className="text-muted text-xs">{a.note}</span> : null}
                </span>
              ),
              split: formatPercent(a.splitPercent, locale),
              validity: validityText(t, a.validFrom, a.validTo, locale),
              state: <StatusBadgeOf map={CO_BROKE_STATUS} value={a.state} size="sm" />,
              actions: canManage ? (
                <span className="flex justify-end gap-2">
                  {!asListing && a.state === "proposed" ? (
                    <CoBrokeAction agreement={a} action="sign" partner={partner} />
                  ) : null}
                  {asListing && a.state === "proposed" ? (
                    <CoBrokeAction agreement={a} action="cancel" partner={partner} />
                  ) : null}
                  {a.contractDocumentId ? (
                    <Button asChild variant="secondary" size="sm">
                      <a
                        href={ownerPath(locale, `/contracts/documents/${a.contractDocumentId}`)}
                        data-testid="co-broke-contract"
                      >
                        {t("contract.open")}
                      </a>
                    </Button>
                  ) : asListing && a.state === "proposed" ? (
                    <Button asChild variant="secondary" size="sm">
                      <a
                        href={ownerPath(locale, `/contracts/documents?new=co_broke&agreement=${a.id}`)}
                        data-testid="co-broke-write-contract"
                      >
                        {t("contract.writeCoBroke")}
                      </a>
                    </Button>
                  ) : null}
                  {a.state === "signed" ? <CoBrokeAction agreement={a} action="end" partner={partner} /> : null}
                </span>
              ) : null,
            },
          };
        })}
      />
    );

  return (
    <OwnerPage testId="co-broke">
      <PageHeader
        title={t("coBroke.title")}
        description={t("coBroke.description")}
        actions={
          canManage && listings.length && agencies.data?.data.length ? (
            <ProposeCoBroke listings={listings} agencies={agencies.data.data} />
          ) : null
        }
      />
      <Callout tone="info">{t("outsideMoney")}</Callout>
      {canManage && !listings.length ? <p className="text-muted text-sm">{t("coBroke.noListings")}</p> : null}
      {!agreements.data ? (
        <SectionError error={agreements.error} />
      ) : (
        <>
          <Card as="section" aria-labelledby="co-broke-invited" className="flex flex-col gap-3">
            <CardHeader title={<span id="co-broke-invited">{t("coBroke.asCo")}</span>} />
            {table(invited, false, "co-broke-invited")}
          </Card>
          <Card as="section" aria-labelledby="co-broke-mine" className="flex flex-col gap-3">
            <CardHeader title={<span id="co-broke-mine">{t("coBroke.asListing")}</span>} />
            {table(mine, true, "co-broke-mine")}
          </Card>
        </>
      )}
    </OwnerPage>
  );
}

/** Closed deals (G2, D-293 (7)): the recorded commission — money moves outside getproperty (ADR-0008). */
export async function DealsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.agency");
  const { api, locale } = context;
  const deals = await section(unwrap(api.GET("/v1/owner/deals")));
  return (
    <OwnerPage testId="deals">
      <PageHeader title={t("deals.title")} description={t("deals.description")} />
      <Callout tone="info">
        <span data-testid="deals-outside">{t("outsideMoney")}</span>
      </Callout>
      {!deals.data ? (
        <SectionError error={deals.error} />
      ) : deals.data.data.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={IconPercent} title={t("deals.empty")} description={t("deals.emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("deals.title")}
          testId="deals-table"
          minWidth="44rem"
          columns={[
            { key: "unit", header: t("columns.unit") },
            { key: "closed", header: t("columns.closed") },
            { key: "rent", header: t("columns.rent"), align: "end" },
            { key: "commission", header: t("deals.commission"), align: "end" },
            { key: "view", header: <span className="sr-only">{t("columns.actions")}</span>, align: "end" },
          ]}
          rows={deals.data.data.map((deal) => ({
            key: deal.id,
            testId: "deal-row",
            cells: {
              unit: (
                <span className="flex flex-col">
                  <span className="font-medium">{t("deals.unit", { unitNo: deal.unitNo })}</span>
                  <span className="text-muted text-xs">{deal.ownerName}</span>
                </span>
              ),
              closed: formatDate(deal.closedAt, locale),
              rent: formatTHB(deal.monthlyRent, locale),
              commission: deal.commissionAmount ? formatTHB(deal.commissionAmount, locale) : t("deals.noCommission"),
              view: (
                <a
                  href={ownerPath(locale, `/deals/${deal.id}`)}
                  className="text-primary font-medium hover:underline"
                  data-testid="deal-open"
                >
                  {t("deals.view")}
                </a>
              ),
            },
          }))}
        />
      )}
    </OwnerPage>
  );
}

export async function DealDetailView({ context, dealId }: { context: OwnerContext; dealId: string }) {
  const t = await getTranslations("owner.agency");
  const { api, locale } = context;
  let deal: Schemas["DealDto"];
  try {
    deal = await unwrap(api.GET("/v1/owner/deals/{dealId}", { params: { path: { dealId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
  return (
    <OwnerPage testId="deal">
      <PageHeader
        title={t("deals.unit", { unitNo: deal.unitNo })}
        description={t("deals.closed", { date: formatDate(deal.closedAt, locale) })}
        crumbs={[{ label: t("deals.title"), href: ownerPath(locale, "/deals") }, { label: deal.unitNo }]}
      />
      <Callout tone="info">
        <span data-testid="deal-outside">{t("outsideMoney")}</span>
      </Callout>
      <Card>
        <DescriptionList
          columns={2}
          items={[
            { id: "owner", term: t("deals.owner"), description: deal.ownerName },
            { id: "listing", term: t("deals.listingAgency"), description: deal.listingAgencyName ?? t("deals.none") },
            { id: "co", term: t("deals.coAgency"), description: deal.coAgencyName ?? t("deals.none") },
            { id: "rent", term: t("columns.rent"), description: formatTHB(deal.monthlyRent, locale) },
            {
              id: "commission",
              term: t("deals.commission"),
              description: (
                <span data-testid="deal-commission">
                  {deal.commissionAmount ? formatTHB(deal.commissionAmount, locale) : t("deals.noCommission")}
                </span>
              ),
            },
            {
              id: "share",
              term: t("deals.coBrokeShare"),
              description: deal.coBrokeAmount ? formatTHB(deal.coBrokeAmount, locale) : null,
            },
          ]}
        />
      </Card>
      <Card as="section" aria-labelledby="deal-fees">
        <CardHeader title={<span id="deal-fees">{t("deals.fees")}</span>} description={t("deals.feesHint")} />
        {deal.accruals.length === 0 ? (
          <p className="text-muted text-sm" data-testid="deal-no-fees">
            {t("deals.noFees")}
          </p>
        ) : (
          <SimpleTable
            caption={t("deals.fees")}
            minWidth="32rem"
            columns={[
              { key: "kind", header: t("columns.fee") },
              { key: "rate", header: t("columns.rate") },
              { key: "amount", header: t("columns.amount"), align: "end" },
              { key: "state", header: t("columns.state") },
            ]}
            rows={deal.accruals.map((fee) => ({
              key: fee.id,
              testId: "deal-fee",
              cells: {
                kind: t(`deals.feeKind.${fee.kind}`),
                rate:
                  fee.billingUnit === "percent_of_amount"
                    ? t("deals.feeRate.percent_of_amount", {
                        rate: formatPercent(fee.rate, locale),
                        base: fee.baseAmount ? formatTHB(fee.baseAmount, locale) : "—",
                      })
                    : t("deals.feeRate.per_deal", { rate: formatTHB(fee.rate, locale) }),
                amount: formatTHB(fee.amount, locale),
                state: (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={fee.invoiced ? "success" : "neutral"} size="sm">
                      {fee.invoiced ? t("deals.invoiced") : t("deals.notInvoiced")}
                    </Badge>
                    {fee.capped ? (
                      <Badge tone="info" size="sm">
                        {t("deals.capped")}
                      </Badge>
                    ) : null}
                  </span>
                ),
              },
            }))}
          />
        )}
      </Card>
    </OwnerPage>
  );
}
