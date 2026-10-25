import { getTranslations } from "next-intl/server";

import { MESSAGING_RATE_STATUS } from "@/domain/status/messagingRate";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";

import { section, type AdminContext } from "../shared/server";
import { PublishMessagingRate } from "./MessagingRateActions";

/**
 * The shared getproperty LINE OA's charge (D-254): the version in force, every version with its maker and checker,
 * and the publish step for versions another user entered. Free messages per tenant (+ per unit) and the price per
 * counted message beyond them; replies and own OAs are never charged.
 */
export async function MessagingRatesView({ context, today }: { context: AdminContext; today: string }) {
  const t = await getTranslations("admin.billing.messaging");
  const { api, locale } = context;
  const rates = await section(unwrap(api.GET("/v1/admin/messaging-rates")));
  const current = rates.data
    ?.filter((rate) => rate.state === "published" && rate.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return (
    <div className="flex flex-col gap-6" data-testid="admin-messaging-rates">
      <p className="text-muted max-w-prose">{t("lead")}</p>
      {current ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="messaging-rate-current">
          <Stat label={t("freePerTenant")} value={formatNumber(current.freePerTenant, locale)} />
          <Stat label={t("freePerUnit")} value={formatNumber(current.freePerUnit, locale)} />
          <Stat
            label={t("price")}
            value={formatTHB(current.pricePerMessage, locale, { decimals: 4 })}
            hint={t("current")}
          />
          <Stat label={t("vat")} value={`${current.vatPercent}%`} />
        </div>
      ) : (
        <Card>
          <EmptyState title={t("none")} description={t("noneHint")} />
        </Card>
      )}
      {!rates.data ? (
        <SectionError error={rates.error} />
      ) : rates.data.length === 0 ? null : (
        <SimpleTable
          caption={t("title")}
          testId="messaging-rates"
          minWidth="48rem"
          columns={[
            { key: "effectiveFrom", header: t("col.effectiveFrom") },
            { key: "free", header: t("col.free") },
            { key: "price", header: t("col.price") },
            { key: "state", header: t("col.state") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={rates.data.map((rate) => ({
            key: rate.id,
            testId: "messaging-rate-row",
            data: { state: rate.state },
            cells: {
              effectiveFrom: formatDate(rate.effectiveFrom, locale),
              free: t("freeValue", { tenant: rate.freePerTenant, unit: rate.freePerUnit }),
              price: `${formatTHB(rate.pricePerMessage, locale, { decimals: 4 })} + VAT ${rate.vatPercent}%`,
              state: (
                <span className="flex flex-col gap-1">
                  <StatusBadgeOf map={MESSAGING_RATE_STATUS} value={rate.state} size="sm" />
                  <span className="text-muted text-xs">
                    {rate.publishedAt
                      ? t("publishedAt", { date: formatDate(rate.publishedAt, locale) })
                      : t("enteredAt", { date: formatDate(rate.enteredAt, locale) })}
                  </span>
                </span>
              ),
              actions: rate.state === "entered" ? <PublishMessagingRate rate={rate} /> : null,
            },
          }))}
        />
      )}
    </div>
  );
}
