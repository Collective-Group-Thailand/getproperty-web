import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatBytes, formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";

import { section, type AdminContext } from "../shared/server";
import { StorageAllowanceEditor, StorageNoticeEditor, StoragePacksEditor } from "./StorageEditors";

const TENANT_TYPES = ["apartment", "condo_juristic", "pm_company", "landlord"] as const;
const LEVEL_TONE = { ok: "success", warning: "warning", full: "danger", over: "danger" } as const;

type Pack = { key: string; gb: string; monthlyPrice: string };

/**
 * Storage (D-276, D-279): what each tenant type gets free and pays above it, the add-on packs and the notice
 * thresholds — all effective-dated settings edited here — and every tenant's latest usage, so the price can be judged
 * against real numbers. A custom deal for one tenant is that tenant's setting override (tenant page → settings).
 */
export async function StorageView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.billing.storage");
  const types = await getTranslations("glossary.tenantType");
  const { api, locale } = context;
  const [settings, usage] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/settings"))),
    section(unwrap(api.GET("/v1/admin/storage/tenants"))),
  ]);
  const value = (key: string) => settings.data?.find((s) => s.key === key)?.value;
  const freeGb = (value("storage.free_gb") ?? {}) as Record<string, string | null>;
  const price = (value("storage.price_per_gb_month") ?? {}) as Record<string, string | null>;
  const packs = (value("storage.packs") ?? []) as Pack[];
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card as="section" aria-labelledby="storage-packs" data-testid="storage-packs">
              <CardHeader
                title={<span id="storage-packs">{t("packs.title")}</span>}
                description={t("packs.description")}
                action={<StoragePacksEditor packs={packs} />}
              />
              {packs.length === 0 ? (
                <p className="text-muted text-sm">{t("packs.none")}</p>
              ) : (
                <ul className="divide-border m-0 list-none divide-y p-0">
                  {packs.map((pack) => (
                    <li key={pack.key} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="flex flex-col">
                        <span className="font-semibold tabular-nums">
                          {t("packs.size", { gb: formatNumber(Number(pack.gb), locale) })}
                        </span>
                        <span className="text-muted font-mono text-xs">{pack.key}</span>
                      </span>
                      <span className="tabular-nums">
                        {t("perMonth", { price: formatTHB(pack.monthlyPrice, locale) })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
          </div>
        </>
      )}

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
            minWidth="44rem"
            columns={[
              { key: "tenant", header: t("usage.tenant") },
              { key: "used", header: t("usage.used"), align: "end" },
              { key: "allowance", header: t("usage.allowance"), align: "end" },
              { key: "level", header: t("usage.level") },
              { key: "day", header: t("usage.day") },
            ]}
            rows={usage.data.data.map((row) => ({
              key: row.tenantId,
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
              },
            }))}
          />
        )}
      </Card>
    </div>
  );
}
