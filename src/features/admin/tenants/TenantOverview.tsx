import { getTranslations } from "next-intl/server";

import { BILLING_CYCLE_STATUS } from "@/domain/status/billingCycle";
import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { FactGrid, type Fact } from "@/ui/components/FactGrid";
import { Timeline } from "@/ui/components/Timeline";
import { Icon } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconShow } from "@/ui/icons/glyphs/show";

import { auditActionLabel, auditActorLabel, platformUserNames } from "../operations/auditLabels";
import { can, section, type AdminContext } from "../shared/server";
import { tenantSectionHref, tenantSections } from "./sections";
import { SubscriptionActions } from "./SubscriptionActions";
import { planOptions } from "./TenantSubscription";

const SIGNAL_TONE: Record<Schemas["TenantHealthSignal"], "warning" | "danger" | "info"> = {
  past_due: "warning",
  suspended: "danger",
  trial_ending: "info",
  no_cycle_this_month: "warning",
  gateways_offline: "warning",
};

/** Where each health signal is worked on (the section of the record, or the platform list it belongs to). */
const SIGNAL_SECTION: Record<Schemas["TenantHealthSignal"], "invoices" | "subscription" | "hardware" | null> = {
  past_due: "invoices",
  suspended: "subscription",
  trial_ending: "subscription",
  no_cycle_this_month: null,
  gateways_offline: "hardware",
};

/**
 * A tenant's overview (F5 5.1, redesign G8): the signals that need someone first (a notice each, with the one link that
 * works on it), the account's health as a hairline grid — the cell with a problem tinted — and the company record; on
 * the right the "manage" panel (the subscription's own next actions, the destructive ones last) and the latest
 * audited activity. Company-level only (D-206).
 */
export async function TenantOverview({
  context,
  tenant,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
}) {
  const t = await getTranslations("admin.tenants.overview");
  const tabs = await getTranslations("admin.tenants.tab");
  const audit = await getTranslations("admin.operations.audit");
  const { api, locale, me } = context;
  const billing = can(me, "admin.subscription.manage");
  const sections = tenantSections(me);
  const [health, subscriptions, plans, activity, users] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/tenants/{tenantId}/health", { params: { path: { tenantId: tenant.id } } }))),
    billing
      ? section(unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { tenantId: tenant.id, perPage: 10 } } })))
      : null,
    billing ? section(unwrap(api.GET("/v1/admin/price-plans"))) : null,
    can(me, "admin.audit.read")
      ? section(unwrap(api.GET("/v1/admin/audit-log", { params: { query: { tenantId: tenant.id, limit: 5 } } })))
      : null,
    platformUserNames(context),
  ]);
  const subscription = subscriptions?.data?.data.find((sub) => sub.state !== "cancelled") ?? null;
  const options = planOptions(plans?.data ?? [], tenant.type);
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

  const facts = (data: Schemas["TenantHealthDto"]): Fact[] => [
    {
      key: "subscription",
      label: t("subscription"),
      value: subscription?.plan.nameTh ?? (data.subscriptionState ? data.planKey : t("noSubscription")),
      hint: data.subscriptionState ? (
        <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={data.subscriptionState} size="sm" />
      ) : undefined,
      tone:
        data.subscriptionState === "suspended"
          ? "danger"
          : data.subscriptionState === "past_due"
            ? "warning"
            : undefined,
    },
    {
      key: "units",
      label: t("units"),
      value: <span data-testid="health-units">{formatNumber(data.units, locale)}</span>,
      hint: t("unitsHint"),
    },
    { key: "buildings", label: t("buildings"), value: formatNumber(data.buildings, locale) },
    {
      key: "cycle",
      label: t("lastCycleLabel"),
      value: data.lastBillingCycle ? formatPeriodKey(data.lastBillingCycle.periodKey, locale) : t("noCycle"),
      hint: data.lastBillingCycle ? (
        <StatusBadgeOf map={BILLING_CYCLE_STATUS} value={data.lastBillingCycle.status} size="sm" />
      ) : undefined,
      tone: data.signals.includes("no_cycle_this_month") ? "warning" : undefined,
      testId: "health-cycle",
    },
    {
      key: "gateways",
      label: t("gateways"),
      value: (
        <span data-testid="health-gateways">
          {t("gatewaysValue", { online: data.gateways.online, total: data.gateways.total })}
        </span>
      ),
      hint: t("gatewaysHint"),
      tone: data.gateways.online < data.gateways.total ? "warning" : undefined,
    },
    {
      key: "overdue",
      label: t("overdue"),
      value: formatTHB(data.overduePlatformAmount, locale),
      hint: t("openInvoicesHint", { count: data.openPlatformInvoices }),
      tone: data.signals.includes("past_due") ? "warning" : undefined,
    },
  ];

  const activityCard = (place: "panel" | "end") =>
    activity?.data && activity.data.data.length > 0 ? (
      <Card as="section" aria-labelledby={`tenant-activity-${place}`} data-testid={`tenant-activity-${place}`}>
        <CardHeader
          title={<span id={`tenant-activity-${place}`}>{t("activity")}</span>}
          action={
            <a
              href={`/audit?tenantId=${tenant.id}`}
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              {t("activityAll")}
            </a>
          }
        />
        <Timeline
          events={activity.data.data.map((entry) => ({
            id: entry.id,
            title: auditActionLabel(audit, entry.action) ?? entry.action,
            time: formatDateTime(entry.occurredAt, locale),
            description: auditActorLabel(audit, entry.actor, users),
          }))}
        />
      </Card>
    ) : null;

  const panel = (
    <div className="flex flex-col gap-6">
      <ActionPanel
        title={t("manage")}
        testId="tenant-manage"
        description={subscription ? undefined : billing ? t("manageNoSubscription") : undefined}
        primary={
          sections.includes("view") ? (
            <Button asChild variant="secondary" iconStart={IconShow}>
              <a href={tenantSectionHref(tenant.id, "view")}>{t("viewAsCustomer")}</a>
            </Button>
          ) : undefined
        }
        secondary={
          subscription ? (
            <SubscriptionActions subscription={subscription} slug={tenant.slug} {...options} />
          ) : billing ? (
            <Button asChild variant="secondary">
              <a href={tenantSectionHref(tenant.id, "subscription")}>{tabs("subscription")}</a>
            </Button>
          ) : undefined
        }
      />
      {activity?.data?.data.length ? <div className="hidden lg:block">{activityCard("panel")}</div> : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {health.data && health.data.signals.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="health-signals">
          {health.data.signals.map((signal) => {
            const target = SIGNAL_SECTION[signal];
            return (
              <li key={signal} data-signal={signal}>
                <Callout
                  tone={SIGNAL_TONE[signal]}
                  title={t(`signal.${signal}.title`)}
                  action={
                    target && sections.includes(target) ? (
                      <a
                        href={tenantSectionHref(tenant.id, target)}
                        className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                      >
                        {t(`signalAction.${target}`)}
                        <Icon icon={IconChevronRight} className="rtl:rotate-180" />
                      </a>
                    ) : undefined
                  }
                >
                  {t(`signal.${signal}.body`, {
                    amount: formatTHB(health.data!.overduePlatformAmount, locale),
                    date: health.data!.trialEndsAt ? formatDate(health.data!.trialEndsAt, locale) : "—",
                  })}
                </Callout>
              </li>
            );
          })}
        </ul>
      ) : null}
      <DetailLayout panel={panel}>
        <Card as="section" aria-labelledby="tenant-health-title" data-testid="tenant-health">
          <CardHeader
            title={<span id="tenant-health-title">{t("health")}</span>}
            description={
              health.data?.trialEndsAt
                ? t("trialEndsLine", { date: formatDateTime(health.data.trialEndsAt, locale) })
                : undefined
            }
          />
          {health.data ? (
            <FactGrid facts={facts(health.data)} label={t("health")} />
          ) : (
            <SectionError error={health.error} />
          )}
        </Card>
        <Card as="section" aria-labelledby="tenant-company">
          <CardHeader title={<span id="tenant-company">{t("company")}</span>} description={t("companyHint")} />
          <DescriptionList
            items={[
              { id: "legalName", term: t("legalName"), description: tenant.legalName },
              { id: "legalForm", term: t("legalForm"), description: t(`form.${tenant.legalForm}`) },
              {
                id: "taxId",
                term: t("taxId"),
                description: tenant.taxId ? <span className="font-mono tabular-nums">{tenant.taxId}</span> : null,
              },
              { id: "vat", term: t("vat"), description: tenant.vatRegistered ? t("yes") : t("no") },
              {
                id: "language",
                term: t("language"),
                description: t(`languageName.${tenant.defaultLanguage === "en" ? "en" : "th"}`),
              },
              { id: "address", term: t("address"), description: address, wide: true },
            ]}
          />
        </Card>
        {activity?.data?.data.length ? <div className="lg:hidden">{activityCard("end")}</div> : null}
      </DetailLayout>
    </div>
  );
}
