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
import { Button } from "@/ui/components/Button";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconGateway } from "@/ui/icons/glyphs/gateway";

import { StateTabs } from "../shared/lists";
import { can, enumParam, pageParam, param, section, tenantNames, withQuery, type AdminContext } from "../shared/server";
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
  const [list, devices, tenants, names] = await Promise.all([
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
    tenantNames(),
  ]);
  const registered = new Set(
    (list.data?.data ?? []).filter((asset) => LIVE.includes(asset.state)).map((asset) => asset.deviceId),
  );
  const candidates = (devices.data?.data ?? [])
    .filter(
      (device) => device.ownership === "platform_haas" && device.status !== "retired" && !registered.has(device.id),
    )
    .map((device) => ({ id: device.id, label: `${device.serial} · ${kinds(device.kind)}` }));

  const q = param(searchParams.q);
  const state = enumParam(searchParams.state, HAAS_VALUES);
  const filtered = Boolean(q || state);
  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        tabs={
          <StateTabs
            states={HAAS_VALUES}
            current={state}
            total={(one) =>
              unwrap(api.GET("/v1/admin/haas-assets", { params: { query: { perPage: 1, q, tenantId, state: one } } }))
            }
            href={(one) => withQuery(path, { q, state: one })}
            label={(one) => status(one)}
            allLabel={t("allStates")}
            navLabel={t("views")}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
        actions={
          manage && devices.data ? (
            <RegisterHaasAsset
              tenantId={tenantId}
              devices={candidates}
              tenants={tenants.data?.data.map((tenant) => ({ id: tenant.id, name: tenant.displayName }))}
            />
          ) : null
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconGateway}
          title={filtered ? t("emptyFiltered") : t("empty")}
          description={filtered ? undefined : t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? path : "/devices"}>{filtered ? t("clear") : t("openDevices")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="haas-table"
            stackOnPhones
            minWidth="64rem"
            columns={[
              { key: "serial", header: t("col.serial"), phone: "title" },
              { key: "state", header: t("col.state"), phone: "status" },
              { key: "term", header: t("col.term"), phone: "meta" },
              { key: "cost", header: t("col.cost"), align: "end", phone: "hidden" },
              { key: "monthly", header: t("col.monthly"), align: "end", phone: "hidden" },
              { key: "book", header: t("col.book"), align: "end", phone: "figure" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                phone: "hidden",
                className: "w-14",
              },
            ]}
            rows={list.data.data.map((asset) => ({
              key: asset.id,
              href: `/devices/${asset.deviceId}`,
              testId: "haas-row",
              data: { serial: asset.serial, state: asset.state },
              cells: {
                serial: (
                  <span className="flex flex-col">
                    <span className="font-mono font-semibold">{asset.serial}</span>
                    <span className="text-muted text-sm font-normal">
                      {kinds.has(asset.kind) ? kinds(asset.kind) : asset.kind}
                      {tenantId ? null : ` · ${names.get(asset.tenantId) ?? t("tenantLink")}`}
                    </span>
                  </span>
                ),
                state: <StatusBadgeOf map={HAAS_STATUS} value={asset.state} size="sm" />,
                term: (
                  <span className="flex flex-col text-sm">
                    <span>{t("termValue", { months: asset.termMonths })}</span>
                    <span className="text-muted">
                      {asset.installedOn
                        ? t("installed", { date: formatDate(asset.installedOn, locale) })
                        : t("notInstalled")}
                      {asset.termEnd ? ` · ${t("until", { date: formatDate(asset.termEnd, locale) })}` : ""}
                    </span>
                  </span>
                ),
                cost: <span className="whitespace-nowrap">{formatTHB(asset.acquisitionCost, locale)}</span>,
                monthly: <span className="whitespace-nowrap">{formatTHB(asset.monthlyValue, locale)}</span>,
                book: (
                  <span className="whitespace-nowrap" data-testid="haas-book-value">
                    {formatTHB(asset.bookValue, locale)}
                  </span>
                ),
                actions:
                  manage && asset.nextActions.length > 0 ? (
                    <span className="relative z-2 flex justify-end">
                      <HaasAssetActions
                        asset={asset}
                        replacements={candidates.filter((candidate) => candidate.id !== asset.deviceId)}
                      />
                    </span>
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
