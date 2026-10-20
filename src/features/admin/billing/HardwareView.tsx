import { getTranslations } from "next-intl/server";

import { HAAS_STATUS, HAAS_VALUES } from "@/domain/status/haas";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconGateway } from "@/ui/icons/glyphs/gateway";

import { can, enumParam, pageParam, param, section, type AdminContext } from "../shared/server";
import { HaasAssetActions, RegisterHaasAsset } from "./HardwareActions";

type SearchParams = Record<string, string | string[] | undefined>;

const LIVE: Schemas["HaasState"][] = ["allocated", "installed", "in_service"];

/**
 * The rented-hardware register (F5 5.1, D-081, D-205): platform-owned devices per tenant with term,
 * acquisition cost, monthly value and the book value the API computes (straight line by whole
 * months), state and history; registering and moving an asset for the platform roles allowed to.
 */
export async function HardwareTable({
  context,
  searchParams,
  tenantId,
  path,
}: {
  context: AdminContext;
  searchParams: SearchParams;
  tenantId?: string;
  path: string;
}) {
  const t = await getTranslations("admin.billing.hardware");
  const status = await getTranslations("status.haas");
  const kinds = await getTranslations("admin.fleet.kind");
  const { api, locale, me } = context;
  const manage = can(me, "admin.device.manage") || can(me, "admin.subscription.manage");
  const [list, devices, tenants] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/haas-assets", {
          params: {
            query: {
              page: pageParam(searchParams.page),
              perPage: 25,
              q: param(searchParams.q),
              tenantId,
              state: enumParam(searchParams.state, HAAS_VALUES),
            },
          },
        }),
      ),
    ),
    manage && can(me, "admin.device.manage")
      ? section(unwrap(api.GET("/v1/admin/devices", { params: { query: { perPage: 100, tenantId } } })))
      : { data: null, error: null },
    manage && !tenantId
      ? section(unwrap(api.GET("/v1/admin/tenants", { params: { query: { perPage: 100 } } })))
      : { data: null, error: null },
  ]);
  const registered = new Set(
    (list.data?.data ?? []).filter((asset) => LIVE.includes(asset.state)).map((asset) => asset.deviceId),
  );
  const candidates = (devices.data?.data ?? [])
    .filter(
      (device) => device.ownership === "platform_haas" && device.status !== "retired" && !registered.has(device.id),
    )
    .map((device) => ({ id: device.id, label: `${device.serial} · ${kinds(device.kind)}` }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar
          fields={[
            { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
            {
              name: "state",
              label: t("state"),
              type: "select",
              placeholder: t("allStates"),
              options: HAAS_VALUES.map((value) => ({ value, label: status(value) })),
            },
          ]}
        />
        {manage && devices.data ? (
          <RegisterHaasAsset
            tenantId={tenantId}
            devices={candidates}
            tenants={tenants.data?.data.map((tenant) => ({ id: tenant.id, name: tenant.displayName }))}
          />
        ) : null}
      </div>
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconGateway} title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="haas-table"
            minWidth="60rem"
            columns={[
              { key: "serial", header: t("col.serial") },
              { key: "state", header: t("col.state") },
              { key: "term", header: t("col.term") },
              { key: "cost", header: t("col.cost"), align: "end" },
              { key: "monthly", header: t("col.monthly"), align: "end" },
              { key: "book", header: t("col.book"), align: "end" },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={list.data.data.map((asset) => ({
              key: asset.id,
              testId: "haas-row",
              data: { serial: asset.serial, state: asset.state },
              cells: {
                serial: (
                  <span className="flex flex-col">
                    <a href={`/devices/${asset.deviceId}`} className="font-mono font-semibold hover:underline">
                      {asset.serial}
                    </a>
                    <span className="text-muted text-xs">
                      {kinds.has(asset.kind) ? kinds(asset.kind) : asset.kind}
                      {tenantId ? "" : ` · `}
                      {tenantId ? null : (
                        <a href={`/tenants/${asset.tenantId}/hardware`} className="hover:underline">
                          {t("tenantLink")}
                        </a>
                      )}
                    </span>
                  </span>
                ),
                state: <StatusBadgeOf map={HAAS_STATUS} value={asset.state} size="sm" />,
                term: (
                  <span className="flex flex-col text-xs">
                    <span>{t("termValue", { months: asset.termMonths })}</span>
                    <span className="text-muted">
                      {asset.installedOn
                        ? t("installed", { date: formatDate(asset.installedOn, locale) })
                        : t("notInstalled")}
                      {asset.termEnd ? ` · ${t("until", { date: formatDate(asset.termEnd, locale) })}` : ""}
                    </span>
                  </span>
                ),
                cost: formatTHB(asset.acquisitionCost, locale),
                monthly: formatTHB(asset.monthlyValue, locale),
                book: <span data-testid="haas-book-value">{formatTHB(asset.bookValue, locale)}</span>,
                actions:
                  manage && asset.nextActions.length > 0 ? (
                    <HaasAssetActions
                      asset={asset}
                      replacements={candidates.filter((candidate) => candidate.id !== asset.deviceId)}
                    />
                  ) : null,
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path={path} searchParams={searchParams} locale={locale} />
        </>
      )}
    </div>
  );
}
