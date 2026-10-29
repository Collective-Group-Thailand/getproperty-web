import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { RENTAL_HANDOFF_STATUS, RENTAL_HANDOFF_VALUES } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBuilding } from "@/ui/icons/glyphs/building";

import { ListingsTabs } from "../listings/ModerationView";
import { can, enumParam, pageParam, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { ResendHandoff } from "./ResendHandoff";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Listings › getbuild handoffs (G8, D-299, O-033): every `unit.transferred` with rental intent — the developer and
 * unit refs, the campaign, delivery of the single-use invitation to getbuild (attempts, last error), the state and
 * the landlord account that claimed it. *Resend* issues a new link to getbuild (the old one stops working). No buyer
 * contact is stored or shown.
 */
export async function RentalHandoffsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.insight.handoffs");
  const listings = await getTranslations("admin.listings");
  const status = await getTranslations("status.rentalHandoff");
  const { api, locale, me } = context;
  if (!can(me, "admin.tenant.read")) notFound();
  const [list, names] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/rental-handoffs", {
          params: {
            query: {
              page: pageParam(searchParams.page),
              perPage: 25,
              state: enumParam(searchParams.state, RENTAL_HANDOFF_VALUES),
            },
          },
        }),
      ),
    ),
    tenantNames(),
  ]);
  const resend = can(me, "admin.tenant.manage");
  return (
    <ConsolePage testId="admin-handoffs">
      <PageHeader title={listings("title")} description={listings("description")} />
      <ListingsTabs context={context} current="/listings/handoffs" />
      <p className="text-muted m-0 text-sm">{t("intro")}</p>
      <FilterBar
        fields={[
          {
            name: "state",
            label: t("state"),
            type: "select",
            placeholder: t("allStates"),
            options: RENTAL_HANDOFF_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconBuilding} title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <>
          <SimpleTable
            caption={listings("tab.handoffs")}
            testId="admin-handoff-table"
            minWidth="60rem"
            columns={[
              { key: "unit", header: t("col.unit") },
              { key: "delivery", header: t("col.delivery") },
              { key: "state", header: t("col.state") },
              { key: "landlord", header: t("col.landlord") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={list.data.data.map((handoff) => ({
              key: handoff.id,
              testId: "admin-handoff-row",
              data: { state: handoff.state, id: handoff.id },
              cells: {
                unit: (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {handoff.buildingRef} · {handoff.unitRef}
                    </span>
                    <span className="text-muted text-xs">
                      {t("developer", { ref: handoff.developerRef })} ·{" "}
                      {t("transfer", { date: formatDate(handoff.transferDate, locale) })}
                    </span>
                    <span>
                      <Badge size="sm">{handoff.campaignTag}</Badge>
                    </span>
                  </span>
                ),
                delivery: (
                  <span className="flex flex-col gap-0.5 text-sm">
                    <span>
                      {handoff.deliveredAt
                        ? t("delivered", { date: formatDateTime(handoff.deliveredAt, locale) })
                        : t("notDelivered")}
                    </span>
                    <span className="text-muted text-xs tabular-nums">
                      {t("attempts", { count: handoff.deliveryAttempts })} ·{" "}
                      {t("expires", { date: formatDate(handoff.expiresAt, locale) })}
                    </span>
                    {handoff.lastDeliveryError ? (
                      <span className="text-muted text-xs" data-testid="admin-handoff-error">
                        {t("lastError", { error: handoff.lastDeliveryError })}
                      </span>
                    ) : null}
                  </span>
                ),
                state: <StatusBadgeOf map={RENTAL_HANDOFF_STATUS} value={handoff.state} size="sm" />,
                landlord: handoff.tenantId ? (
                  <a href={`/tenants/${handoff.tenantId}`} className="hover:underline">
                    {tenantLabel(names, handoff.tenantId, "—")}
                  </a>
                ) : (
                  <span className="text-muted">{t("unclaimed")}</span>
                ),
                actions:
                  resend && handoff.state === "invited" ? (
                    <ResendHandoff handoffId={handoff.id} unit={`${handoff.buildingRef} · ${handoff.unitRef}`} />
                  ) : null,
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path="/listings/handoffs" searchParams={searchParams} locale={locale} />
        </>
      )}
    </ConsolePage>
  );
}
