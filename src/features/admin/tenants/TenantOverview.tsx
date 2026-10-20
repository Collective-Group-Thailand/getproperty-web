import { getTranslations } from "next-intl/server";

import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Stat } from "@/ui/components/Stat";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { section, type AdminContext } from "../shared/server";

const SIGNAL_TONE: Record<Schemas["TenantHealthSignal"], "warning" | "danger" | "info"> = {
  past_due: "warning",
  suspended: "danger",
  trial_ending: "info",
  no_cycle_this_month: "warning",
  gateways_offline: "warning",
};

/**
 * A tenant's overview (F5 5.1): company data from onboarding and its health — company-level only
 * (D-206): subscription state, units counted today, buildings, gateway connectivity, the last billing
 * cycle, platform receivables, and the signals that need someone's attention.
 */
export async function TenantOverview({
  context,
  tenant,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
}) {
  const t = await getTranslations("admin.tenants.overview");
  const { api, locale } = context;
  const health = await section(
    unwrap(api.GET("/v1/admin/tenants/{tenantId}/health", { params: { path: { tenantId: tenant.id } } })),
  );
  const address = tenant.address
    ? [
        tenant.address.line1,
        tenant.address.line2,
        tenant.address.subdistrict,
        tenant.address.district,
        tenant.address.province,
        tenant.address.postcode,
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  return (
    <div className="flex flex-col gap-6">
      {health.data ? (
        <>
          {health.data.signals.length > 0 ? (
            <ul className="flex flex-col gap-2" data-testid="health-signals">
              {health.data.signals.map((signal) => (
                <li key={signal} data-signal={signal}>
                  <Callout tone={SIGNAL_TONE[signal]} title={t(`signal.${signal}.title`)}>
                    {t(`signal.${signal}.body`, {
                      amount: formatTHB(health.data!.overduePlatformAmount, locale),
                      date: health.data!.trialEndsAt ? formatDate(health.data!.trialEndsAt, locale) : "—",
                    })}
                  </Callout>
                </li>
              ))}
            </ul>
          ) : null}
          <section aria-labelledby="tenant-health" className="flex flex-col gap-3" data-testid="tenant-health">
            <h2 id="tenant-health" className="text-lg font-semibold">
              {t("health")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={IconWallet}
                label={t("subscription")}
                value={
                  health.data.subscriptionState ? (
                    <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={health.data.subscriptionState} />
                  ) : (
                    t("noSubscription")
                  )
                }
                hint={health.data.planKey ?? undefined}
              />
              <Stat
                icon={IconRoom}
                label={t("units")}
                value={<span data-testid="health-units">{formatNumber(health.data.units, locale)}</span>}
                hint={t("unitsHint")}
              />
              <Stat
                icon={IconBuilding}
                label={t("buildings")}
                value={formatNumber(health.data.buildings, locale)}
                hint={
                  health.data.lastBillingCycle
                    ? t("lastCycle", {
                        period: formatPeriodKey(health.data.lastBillingCycle.periodKey, locale),
                        status: health.data.lastBillingCycle.status,
                      })
                    : t("noCycle")
                }
              />
              <Stat
                icon={IconGateway}
                label={t("gateways")}
                value={
                  <span data-testid="health-gateways">
                    {t("gatewaysValue", { online: health.data.gateways.online, total: health.data.gateways.total })}
                  </span>
                }
                hint={t("gatewaysHint")}
              />
            </div>
            <Card>
              <DescriptionList
                columns={3}
                items={[
                  {
                    id: "openInvoices",
                    term: t("openInvoices"),
                    description: formatNumber(health.data.openPlatformInvoices, locale),
                  },
                  {
                    id: "overdue",
                    term: t("overdue"),
                    description: formatTHB(health.data.overduePlatformAmount, locale),
                  },
                  {
                    id: "trial",
                    term: t("trialEnds"),
                    description: health.data.trialEndsAt ? formatDateTime(health.data.trialEndsAt, locale) : null,
                  },
                ]}
              />
            </Card>
          </section>
        </>
      ) : (
        <SectionError error={health.error} />
      )}
      <Card as="section" aria-labelledby="tenant-company">
        <CardHeader title={<span id="tenant-company">{t("company")}</span>} description={t("companyHint")} />
        <DescriptionList
          items={[
            { id: "legalName", term: t("legalName"), description: tenant.legalName },
            { id: "legalForm", term: t("legalForm"), description: t(`form.${tenant.legalForm}`) },
            { id: "taxId", term: t("taxId"), description: tenant.taxId },
            { id: "vat", term: t("vat"), description: tenant.vatRegistered ? t("yes") : t("no") },
            { id: "language", term: t("language"), description: tenant.defaultLanguage },
            { id: "address", term: t("address"), description: address, wide: true },
          ]}
        />
      </Card>
    </div>
  );
}
