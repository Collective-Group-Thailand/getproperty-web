import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatBytes, formatDate, formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";

import { section, type AdminContext } from "../shared/server";
import { StorageAllowanceEditor, StorageNoticeEditor } from "./StorageEditors";
import { EditStoragePackage, NewStoragePackage, ReconcileNow, StorageQuotaEditor } from "./StoragePackageEditors";

const TENANT_TYPES = ["apartment", "condo_juristic", "pm_company", "landlord", "agency"] as const;
const LEVEL_TONE = { ok: "success", warning: "warning", full: "danger", over: "danger" } as const;
const GIB = 1024 ** 3;

/**
 * Storage (D-276, D-279): what each tenant type gets free and pays above it, the add-on packs and the notice
 * thresholds — all effective-dated settings edited here — and every tenant's latest usage, so the price can be judged
 * against real numbers. A custom deal for one tenant is that tenant's setting override (tenant page → settings).
 */
export async function StorageView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.billing.storage");
  const types = await getTranslations("glossary.tenantType");
  const { api, locale } = context;
  const [settings, usage, definitions, reconciliations] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/settings"))),
    section(unwrap(api.GET("/v1/admin/storage/tenants"))),
    section(unwrap(api.GET("/v1/admin/storage/packages"))),
    section(unwrap(api.GET("/v1/admin/storage/reconciliations", { params: { query: { perPage: 10 } } }))),
  ]);
  const value = (key: string) => settings.data?.find((s) => s.key === key)?.value;
  const freeGb = (value("storage.free_gb") ?? {}) as Record<string, string | null>;
  const price = (value("storage.price_per_gb_month") ?? {}) as Record<string, string | null>;
  const thresholds = (value("storage.notice_at_percent") ?? [80, 100]) as number[];
  const typeList = TENANT_TYPES.map((key) => ({ key, label: types(key) }));

  return (
    <div className="flex flex-col gap-6" data-testid="admin-storage">
      {usage.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label={t("stats.tenants")} value={formatNumber(usage.data.totals.tenants, locale)} />
          <Stat label={t("stats.used")} value={formatBytes(usage.data.totals.usedBytes, locale)} />
          <Stat
            label={t("stats.nearOrOver")}
            value={<span data-testid="storage-near-or-over">{formatNumber(usage.data.totals.nearOrOver, locale)}</span>}
            hint={t("stats.nearOrOverHint", { percent: thresholds[0] ?? 80 })}
          />
        </div>
      ) : null}

      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        <>
          <Card as="section" aria-labelledby="storage-allowance" data-testid="storage-allowance">
            <CardHeader
              title={<span id="storage-allowance">{t("allowance.title")}</span>}
              description={t("allowance.description")}
              action={<StorageAllowanceEditor types={typeList} freeGb={freeGb} price={price} />}
            />
            <SimpleTable
              caption={t("allowance.title")}
              minWidth="28rem"
              columns={[
                { key: "type", header: t("allowance.type") },
                { key: "free", header: t("allowance.freeGb"), align: "end" },
                { key: "price", header: t("allowance.price"), align: "end" },
              ]}
              rows={typeList.map(({ key, label }) => ({
                key,
                testId: "storage-type-row",
                data: { type: key },
                cells: {
                  type: label,
                  free: freeGb[key] ? t("gb", { gb: formatNumber(Number(freeGb[key]), locale) }) : t("noLimit"),
                  price: price[key] ? t("perGbMonth", { price: formatTHB(price[key]!, locale) }) : t("notSold"),
                },
              }))}
            />
          </Card>

          <Card as="section" aria-labelledby="storage-notices" data-testid="storage-notices">
            <CardHeader
              title={<span id="storage-notices">{t("notices.title")}</span>}
              description={t("notices.description")}
              action={<StorageNoticeEditor thresholds={thresholds} />}
            />
            <p className="flex flex-wrap gap-2">
              {thresholds.map((pct) => (
                <Badge key={pct} tone={pct >= 100 ? "danger" : "warning"} size="sm">
                  {t("usage.percent", { percent: pct })}
                </Badge>
              ))}
            </p>
          </Card>
        </>
      )}

      <StoragePackagesCard definitions={definitions} context={context} types={typeList} />

      <Card as="section" aria-labelledby="storage-usage">
        <CardHeader title={<span id="storage-usage">{t("usage.title")}</span>} description={t("usage.description")} />
        {!usage.data ? (
          <SectionError error={usage.error} />
        ) : usage.data.data.length === 0 ? (
          <EmptyState title={t("usage.empty")} description={t("usage.emptyHint")} />
        ) : (
          <SimpleTable
            caption={t("usage.title")}
            testId="storage-usage"
            minWidth="56rem"
            columns={[
              { key: "tenant", header: t("usage.tenant") },
              { key: "used", header: t("usage.used"), align: "end" },
              { key: "allowance", header: t("usage.allowance"), align: "end" },
              { key: "level", header: t("usage.level") },
              { key: "day", header: t("usage.day") },
              { key: "actions", header: <span className="sr-only">{t("usage.actions")}</span>, align: "end" },
            ]}
            rows={usage.data.data.map((row) => ({
              key: row.tenantId,
              data: { tenant: row.tenantId },
              testId: "storage-usage-row",
              tone: row.level === "over" || row.level === "full" ? "danger" : "default",
              cells: {
                tenant: (
                  <span className="flex flex-col">
                    <span className="font-medium">{row.displayName}</span>
                    <span className="text-muted text-xs">{types.has(row.type) ? types(row.type) : row.type}</span>
                  </span>
                ),
                used: formatBytes(row.usedBytes, locale),
                allowance: row.allowanceBytes ? formatBytes(row.allowanceBytes, locale) : t("noLimit"),
                level: row.level ? (
                  <Badge tone={LEVEL_TONE[row.level]} size="sm">
                    {t("usage.percent", { percent: row.usedPercent ?? 0 })}
                  </Badge>
                ) : (
                  <span className="text-muted text-sm">{t("noLimit")}</span>
                ),
                day: formatDate(row.day, locale),
                actions: (
                  <span className="flex flex-wrap justify-end gap-1">
                    <StorageQuotaEditor
                      tenantId={row.tenantId}
                      name={row.displayName}
                      freeGb={row.allowanceBytes ? String(Number(row.allowanceBytes) / GIB) : null}
                    />
                    <ReconcileNow tenantId={row.tenantId} />
                  </span>
                ),
              },
            }))}
          />
        )}
      </Card>

      <ReconciliationsCard reconciliations={reconciliations} usage={usage.data?.data ?? []} context={context} />
    </div>
  );
}

type Section<T> = { data: T; error: null } | { data: null; error: unknown };

/**
 * Storage packages (G1, D-285): the definitions tenants buy from — size, period, tenant type, visibility, the price of
 * the version in force (none until the founder sets it, O-022, then "not on sale yet" for owners) and the active
 * window. New definitions here; a price change is a new price-plan version on Price plans (never backdated, D-291).
 */
async function StoragePackagesCard({
  definitions,
  context,
  types,
}: {
  definitions: Section<Schemas["StoragePackageDefinitionsDto"]>;
  context: AdminContext;
  types: { key: string; label: string }[];
}) {
  const t = await getTranslations("admin.billing.storage.packages");
  const tenantTypes = await getTranslations("glossary.tenantType");
  const { locale } = context;
  return (
    <Card as="section" aria-labelledby="storage-packages" data-testid="storage-packages">
      <CardHeader
        title={<span id="storage-packages">{t("title")}</span>}
        description={
          <>
            {t("description")}{" "}
            <Link href="/subscriptions/plans" className="text-primary font-medium hover:underline">
              {t("pricePlans")}
            </Link>
          </>
        }
        action={<NewStoragePackage types={types} />}
      />
      {!definitions.data ? (
        <SectionError error={definitions.error} />
      ) : definitions.data.data.length === 0 ? (
        <p className="text-muted text-sm">{t("none")}</p>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="storage-package-definitions"
          minWidth="52rem"
          columns={[
            { key: "package", header: t("columns.package") },
            { key: "size", header: t("columns.size"), align: "end" },
            { key: "period", header: t("columns.period") },
            { key: "price", header: t("columns.price"), align: "end" },
            { key: "window", header: t("columns.window") },
            { key: "state", header: t("columns.state") },
            { key: "actions", header: <span className="sr-only">{t("edit")}</span>, align: "end" },
          ]}
          rows={definitions.data.data.map((d) => ({
            key: d.id,
            testId: "storage-package-row",
            data: { key: d.key, onSale: d.onSale, active: d.isActive },
            cells: {
              package: (
                <span className="flex flex-col">
                  <span className="font-medium">{locale === "th" ? d.nameTh : d.nameEn}</span>
                  <span className="text-muted font-mono text-xs">{d.key}</span>
                  <span className="text-muted text-xs">
                    {d.tenantType
                      ? tenantTypes.has(d.tenantType)
                        ? tenantTypes(d.tenantType)
                        : d.tenantType
                      : t("allTypes")}
                    {d.visibility === "hidden" ? ` · ${t("hidden")}` : ""}
                  </span>
                </span>
              ),
              size: formatBytes(d.sizeBytes, locale),
              period: t(`periodOption.${d.period}`),
              price: (
                <span className="flex flex-col items-end">
                  <span>{d.unitPrice ? t("price", { price: formatTHB(d.unitPrice, locale) }) : t("noPrice")}</span>
                  {d.versionState ? (
                    <span className="text-muted text-xs">{t("version", { state: d.versionState })}</span>
                  ) : null}
                </span>
              ),
              window: d.effectiveFrom
                ? d.effectiveTo
                  ? t("window", { from: formatDate(d.effectiveFrom, locale), to: formatDate(d.effectiveTo, locale) })
                  : t("windowOpen", { from: formatDate(d.effectiveFrom, locale) })
                : "—",
              state: !d.isActive ? (
                <Badge tone="neutral" size="sm">
                  {t("inactive")}
                </Badge>
              ) : d.onSale ? (
                <Badge tone="success" size="sm">
                  {t("onSale")}
                </Badge>
              ) : (
                <Badge tone="warning" size="sm">
                  {t("unpriced")}
                </Badge>
              ),
              actions: <EditStoragePackage definition={d} />,
            },
          }))}
        />
      )}
    </Card>
  );
}

/** The nightly reconciliation reports (D-286): object storage vs counters, the drift and whether it was corrected. */
async function ReconciliationsCard({
  reconciliations,
  usage,
  context,
}: {
  reconciliations: Section<Schemas["StorageReconciliationPageDto"]>;
  usage: Schemas["AdminStorageTenantDto"][];
  context: AdminContext;
}) {
  const t = await getTranslations("admin.billing.storage.reconciliations");
  const { locale } = context;
  const name = (tenantId: string) =>
    usage.find((row) => row.tenantId === tenantId)?.displayName ?? tenantId.slice(0, 8);
  return (
    <Card as="section" aria-labelledby="storage-reconciliations">
      <CardHeader title={<span id="storage-reconciliations">{t("title")}</span>} description={t("description")} />
      {!reconciliations.data ? (
        <SectionError error={reconciliations.error} />
      ) : reconciliations.data.data.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="storage-reconciliations"
          minWidth="48rem"
          columns={[
            { key: "tenant", header: t("tenant") },
            { key: "ranAt", header: t("ranAt") },
            { key: "storage", header: t("storage"), align: "end" },
            { key: "counters", header: t("counters"), align: "end" },
            { key: "drift", header: t("drift"), align: "end" },
            { key: "corrected", header: t("corrected") },
            { key: "orphans", header: t("orphans"), align: "end" },
          ]}
          rows={reconciliations.data.data.map((run) => {
            const details = run.details as { orphanCount?: number; missingCount?: number };
            const drift = Number(run.driftBytes);
            return {
              key: run.id,
              testId: "storage-reconciliation-row",
              tone: drift !== 0 && !run.corrected ? "warning" : "default",
              cells: {
                tenant: name(run.tenantId),
                ranAt: formatDateTime(run.ranAt, locale),
                storage: (
                  <span className="flex flex-col items-end">
                    <span>{formatBytes(run.s3Bytes, locale)}</span>
                    <span className="text-muted text-xs">
                      {t("objects", { count: formatNumber(Number(run.s3Objects), locale) })}
                    </span>
                  </span>
                ),
                counters: (
                  <span className="flex flex-col items-end">
                    <span>{formatBytes(run.dbBytes, locale)}</span>
                    <span className="text-muted text-xs">
                      {t("objects", { count: formatNumber(Number(run.dbObjects), locale) })}
                    </span>
                  </span>
                ),
                drift: `${drift < 0 ? "−" : drift > 0 ? "+" : ""}${formatBytes(Math.abs(drift), locale)}`,
                corrected: run.corrected ? t("yes") : t("no"),
                orphans: `${formatNumber(details.orphanCount ?? 0, locale)} / ${formatNumber(details.missingCount ?? 0, locale)}`,
              },
            };
          })}
        />
      )}
    </Card>
  );
}
