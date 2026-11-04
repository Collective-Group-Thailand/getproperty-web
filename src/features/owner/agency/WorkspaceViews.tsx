import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LISTING_STATUS, type ListingState } from "@/domain/status/listing";
import { CO_BROKE_STATUS } from "@/domain/status/mandate";
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
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Paper, PaperHead, PaperParties, PaperSection } from "@/ui/components/Paper";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement } from "@/ui/components/Statement";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconPercent } from "@/ui/icons/glyphs/percent";
import { IconSwap } from "@/ui/icons/glyphs/swap";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { CoBrokeAction, ProposeCoBroke } from "./CoBrokeActions";
import { validityText } from "./MandatesView";
import { RequestCard } from "./RequestCard";

const LISTING_STATES = ["draft", "pending_review", "published", "paused", "rejected", "closed"];

/**
 * An agency's granted portfolio (G2, D-293; G5): the units owners mandated to it — and only those — as one table: the
 * unit and where it is, the owner, scope and exclusivity, the commission recorded, validity and the agency's listing
 * of each, with the one next step (open the listing, or list the unit).
 */
export async function MandatedUnitsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.agency");
  const listingStatus = await getTranslations("status.listing");
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
      <Callout tone="neutral" icon={IconInfo}>
        {t("outsideMoney")}
      </Callout>
      {!units.data ? (
        <SectionError error={units.error} />
      ) : units.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconKey}
          title={t("units.empty")}
          description={t("units.emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/mandates")}>{t("units.inbox")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("units.title")}
          testId="mandated-unit-rows"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "unit", header: t("columns.unit"), phone: "title" },
            { key: "owner", header: t("deals.owner"), phone: "meta" },
            { key: "scope", header: t("mandates.fields.scope"), phone: "hidden" },
            { key: "commission", header: t("columns.commission"), align: "end", phone: "figure" },
            { key: "validity", header: t("columns.validity"), phone: "meta" },
            { key: "listing", header: t("columns.listing"), phone: "status" },
            { key: "actions", header: <span className="sr-only">{t("columns.actions")}</span>, align: "end" },
          ]}
          rows={units.data.data.map((unit) => ({
            key: unit.unitId,
            testId: "mandated-unit",
            data: { "unit-no": unit.unitNo },
            cells: {
              unit: (
                <span className="flex flex-col">
                  <span className="font-medium">{t("mandates.unit", { unitNo: unit.unitNo })}</span>
                  <span className="text-muted text-sm">
                    {[unit.buildingName, unit.district, unit.province].filter(Boolean).join(" · ")}
                    {unit.areaSqm ? ` · ${t("units.area", { area: formatDecimal(unit.areaSqm, locale) })}` : ""}
                  </span>
                </span>
              ),
              owner: unit.mandate.ownerName,
              scope: (
                <span className="flex flex-wrap items-center gap-1.5">
                  {t(`scope.${unit.mandate.scope}`)}
                  {unit.mandate.exclusive ? (
                    <Badge tone="primary" size="sm">
                      {t("exclusive")}
                    </Badge>
                  ) : null}
                </span>
              ),
              commission: unit.mandate.commissionAmount
                ? formatTHB(unit.mandate.commissionAmount, locale)
                : unit.mandate.commissionPercent
                  ? t("commission.percentShort", { percent: formatPercent(unit.mandate.commissionPercent, locale) })
                  : t("commission.noneShort"),
              validity: validityText(t, unit.mandate.validFrom, unit.mandate.validTo, locale),
              listing: unit.listing ? (
                LISTING_STATES.includes(unit.listing.state) ? (
                  <StatusBadgeOf map={LISTING_STATUS} value={unit.listing.state as ListingState} size="sm" />
                ) : listingStatus.has(unit.listing.state) ? (
                  listingStatus(unit.listing.state)
                ) : null
              ) : (
                <span className="text-muted">{t("units.noListing")}</span>
              ),
              actions: unit.listing ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={ownerPath(locale, `/listings/${unit.listing.id}`)}>{t("units.openListing")}</a>
                </Button>
              ) : (
                <Button asChild size="sm" variant="secondary" iconStart={IconAdd}>
                  <a href={ownerPath(locale, `/listings/new?unit=${unit.unitId}`)} data-testid="mandated-list-it">
                    {t("units.listIt")}
                  </a>
                </Button>
              ),
            },
          }))}
        />
      )}
    </OwnerPage>
  );
}

/**
 * Co-broke agreements (G2, D-293 (6); G5): proposed by the listing agency, signed in-app by the co-agency. A proposal
 * waiting for my signature comes as a request card with the one filled answer; the rest of each side as a table.
 */
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
  const toSign = invited.filter((a) => a.state === "proposed");
  const invitedRest = invited.filter((a) => a.state !== "proposed");

  const actions = (a: Schemas["CoBrokeDto"], asListing: boolean) => {
    const partner = asListing ? a.coAgencyName : a.listingAgencyName;
    return canManage ? (
      <span className="flex justify-end gap-2">
        {asListing && a.state === "proposed" ? <CoBrokeAction agreement={a} action="cancel" partner={partner} /> : null}
        {a.contractDocumentId ? (
          <Button asChild variant="secondary" size="sm">
            <a href={ownerPath(locale, `/contracts/documents/${a.contractDocumentId}`)} data-testid="co-broke-contract">
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
    ) : null;
  };

  const table = (rows: Schemas["CoBrokeDto"][], asListing: boolean) =>
    rows.length === 0 ? null : (
      <SimpleTable
        caption={asListing ? t("coBroke.asListing") : t("coBroke.asCo")}
        stackOnPhones
        minWidth="48rem"
        columns={[
          { key: "listing", header: t("coBroke.fields.listing"), phone: "title" },
          { key: "split", header: t("coBroke.fields.splitShort"), align: "end", phone: "figure" },
          { key: "validity", header: t("columns.validity"), phone: "meta" },
          { key: "state", header: t("columns.state"), phone: "status" },
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
                  <span className="text-muted text-sm">
                    {asListing ? t("coBroke.with", { name: partner }) : t("coBroke.from", { name: partner })}
                  </span>
                  {a.note ? <span className="text-muted text-sm">{a.note}</span> : null}
                </span>
              ),
              split: formatPercent(a.splitPercent, locale),
              validity: validityText(t, a.validFrom, a.validTo, locale),
              state: <StatusBadgeOf map={CO_BROKE_STATUS} value={a.state} size="sm" />,
              actions: actions(a, asListing),
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
      <Callout tone="neutral" icon={IconInfo}>
        {t("outsideMoney")}
      </Callout>
      {!agreements.data ? (
        <SectionError error={agreements.error} />
      ) : (
        <>
          <section
            aria-labelledby="co-broke-invited-title"
            className="flex flex-col gap-3"
            data-testid="co-broke-invited"
          >
            <h2 id="co-broke-invited-title" className="text-lg font-semibold">
              {t("coBroke.asCo")}
            </h2>
            {toSign.length ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {toSign.map((a) => (
                  <RequestCard
                    key={a.id}
                    testId="co-broke-row"
                    data={{ state: a.state }}
                    title={t("coBroke.listing", { slug: a.listingSlug })}
                    subtitle={t("coBroke.from", { name: a.listingAgencyName })}
                    status={<StatusBadgeOf map={CO_BROKE_STATUS} value={a.state} size="sm" />}
                    facts={[
                      { key: "partner", label: t("coBroke.fields.listingAgency"), value: a.listingAgencyName },
                      {
                        key: "split",
                        label: t("coBroke.fields.splitShort"),
                        value: t("coBroke.split", { percent: formatPercent(a.splitPercent, locale) }),
                      },
                      {
                        key: "validity",
                        label: t("columns.validity"),
                        value: validityText(t, a.validFrom, a.validTo, locale),
                      },
                      { key: "note", label: t("coBroke.fields.note"), value: a.note ?? "—" },
                    ]}
                    actions={
                      canManage ? (
                        <CoBrokeAction agreement={a} action="sign" partner={a.listingAgencyName} stacked />
                      ) : null
                    }
                  />
                ))}
              </ul>
            ) : null}
            {table(invitedRest, false)}
            {invited.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconSwap}
                title={t("coBroke.emptyInvited")}
                description={t("coBroke.emptyInvitedHint")}
                action={
                  <Button asChild variant="secondary">
                    <a href={ownerPath(locale, "/mandated-units")}>{t("units.title")}</a>
                  </Button>
                }
              />
            ) : null}
          </section>
          <section aria-labelledby="co-broke-mine-title" className="flex flex-col gap-3" data-testid="co-broke-mine">
            <h2 id="co-broke-mine-title" className="text-lg font-semibold">
              {t("coBroke.asListing")}
            </h2>
            {table(mine, true)}
            {mine.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconSwap}
                title={t("coBroke.empty")}
                description={listings.length ? t("coBroke.emptyMineHint") : t("coBroke.noListings")}
                action={
                  <Button asChild variant="secondary">
                    <a href={ownerPath(locale, "/mandated-units")}>{t("units.title")}</a>
                  </Button>
                }
              />
            ) : null}
          </section>
        </>
      )}
    </OwnerPage>
  );
}

/**
 * Closed deals (G2, D-293 (7); G5): one row per deal — the unit and its owner, when it closed, the monthly rent and the
 * commission recorded — the whole row opens the deal. Money moves outside getproperty (ADR-0008): said once, quietly.
 */
export async function DealsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.agency");
  const { api, locale, me } = context;
  const deals = await section(unwrap(api.GET("/v1/owner/deals")));
  const isAgency = me.currentTenant?.type === "agency";
  return (
    <OwnerPage testId="deals">
      <PageHeader title={t("deals.title")} description={t("deals.description")} />
      <Callout tone="neutral" icon={IconInfo}>
        <span data-testid="deals-outside">{t("outsideMoney")}</span>
      </Callout>
      {!deals.data ? (
        <SectionError error={deals.error} />
      ) : deals.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconPercent}
          title={t("deals.empty")}
          description={t("deals.emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, isAgency ? "/mandated-units" : "/listings")}>
                {isAgency ? t("deals.toUnits") : t("deals.toListings")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("deals.title")}
          testId="deals-table"
          stackOnPhones
          minWidth="40rem"
          columns={[
            { key: "unit", header: t("columns.unit"), phone: "title" },
            { key: "closed", header: t("columns.closed"), phone: "meta" },
            { key: "rent", header: t("columns.rent"), align: "end", phone: "hidden" },
            { key: "commission", header: t("deals.commission"), align: "end", phone: "figure" },
          ]}
          rows={deals.data.data.map((deal) => ({
            key: deal.id,
            testId: "deal-row",
            href: ownerPath(locale, `/deals/${deal.id}`),
            cells: {
              unit: (
                <span className="flex flex-col" data-testid="deal-open">
                  <span className="font-medium">{t("deals.unit", { unitNo: deal.unitNo })}</span>
                  <span className="text-muted text-sm font-normal">{deal.ownerName}</span>
                </span>
              ),
              closed: formatDate(deal.closedAt, locale),
              rent: formatTHB(deal.monthlyRent, locale),
              commission: deal.commissionAmount ? (
                formatTHB(deal.commissionAmount, locale)
              ) : (
                <span className="text-muted">{t("deals.noCommission")}</span>
              ),
            },
          }))}
        />
      )}
    </OwnerPage>
  );
}

/**
 * One closed deal (G5) as a statement on paper: who the parties were, then the monthly rent, the commission recorded
 * and the co-agency's share indented under it — the API's figures, never added up here — and getproperty's own fees
 * for the deal. Beside it, where the deal came from (listing, mandate, co-broke agreement) as links.
 */
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
  const sources = [
    ...(deal.listingId
      ? [{ key: "listing", label: t("deals.source.listing"), href: ownerPath(locale, `/listings/${deal.listingId}`) }]
      : []),
    ...(deal.mandateId
      ? [{ key: "mandate", label: t("deals.source.mandate"), href: ownerPath(locale, "/mandates?view=active") }]
      : []),
    ...(deal.coBrokeAgreementId
      ? [{ key: "coBroke", label: t("deals.source.coBroke"), href: ownerPath(locale, "/co-broke") }]
      : []),
  ];
  return (
    <OwnerPage testId="deal">
      <PageHeader
        title={t("deals.unit", { unitNo: deal.unitNo })}
        description={t("deals.closed", { date: formatDate(deal.closedAt, locale) })}
        crumbs={[{ label: t("deals.title"), href: ownerPath(locale, "/deals") }, { label: deal.unitNo }]}
      />
      <DetailLayout
        panelFirstOnPhones={false}
        panel={
          <ActionPanel
            title={t("deals.source.title")}
            description={sources.length ? undefined : t("deals.source.none")}
            footer={
              sources.length ? (
                <ul className="-mx-5 -my-4 list-none p-0">
                  {sources.map((source) => (
                    <li key={source.key} className="border-border border-b last:border-b-0">
                      <a
                        href={source.href}
                        className="hover:bg-bg-subtle text-fg flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium transition-colors"
                      >
                        {source.label}
                        <Icon icon={IconChevronRight} className="text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        }
      >
        <Paper label={t("deals.paper", { unitNo: deal.unitNo })}>
          <PaperHead
            kind={t("deals.paperKind")}
            number={deal.unitNo}
            facts={[{ key: "closed", label: t("columns.closed"), value: formatDate(deal.closedAt, locale) }]}
          />
          <PaperParties
            items={[
              { key: "owner", label: t("deals.owner"), value: deal.ownerName },
              { key: "listing", label: t("deals.listingAgency"), value: deal.listingAgencyName ?? t("deals.none") },
              { key: "co", label: t("deals.coAgency"), value: deal.coAgencyName ?? t("deals.none") },
            ]}
          />
          <PaperSection title={t("deals.money")}>
            <Statement
              caption={t("deals.money")}
              lines={[
                { key: "rent", label: t("columns.rent"), value: formatTHB(deal.monthlyRent, locale) },
                {
                  key: "commission",
                  label: t("deals.commission"),
                  value: (
                    <span data-testid="deal-commission">
                      {deal.commissionAmount ? formatTHB(deal.commissionAmount, locale) : t("deals.noCommission")}
                    </span>
                  ),
                },
                ...(deal.coBrokeAmount
                  ? [
                      {
                        key: "share",
                        label: t("deals.coBrokeShareOf", { name: deal.coAgencyName ?? t("deals.coAgency") }),
                        value: formatTHB(deal.coBrokeAmount, locale),
                        level: 1 as const,
                      },
                    ]
                  : []),
              ]}
            />
            <Callout tone="neutral" size="sm" live={false} icon={IconInfo}>
              <span data-testid="deal-outside">{t("outsideMoney")}</span>
            </Callout>
          </PaperSection>
          <PaperSection title={t("deals.fees")}>
            <p className="text-muted m-0 text-sm">{t("deals.feesHint")}</p>
            {deal.accruals.length === 0 ? (
              <p className="text-muted m-0 text-sm" data-testid="deal-no-fees">
                {t("deals.noFees")}
              </p>
            ) : (
              <SimpleTable
                caption={t("deals.fees")}
                minWidth="32rem"
                columns={[
                  { key: "kind", header: t("columns.fee") },
                  { key: "rate", header: t("columns.rate") },
                  { key: "state", header: t("columns.state") },
                  { key: "amount", header: t("columns.amount"), align: "end" },
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
          </PaperSection>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}
