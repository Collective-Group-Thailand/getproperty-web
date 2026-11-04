import { getTranslations } from "next-intl/server";

import { messageKey } from "@/i18n/keys";
import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatPercent } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { FactGrid, type Fact } from "@/ui/components/FactGrid";
import { EmptyState } from "@/ui/components/EmptyState";
import { Timeline } from "@/ui/components/Timeline";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { can, section, type AdminContext } from "../shared/server";
import { SubscribeButton, SubscriptionActions, type PlanOption } from "./SubscriptionActions";

/** Plans and add-ons that can be sold to a tenant of this type (published, `isActive`, D-204). */
export function planOptions(plans: Schemas["PricePlanDto"][], type: Schemas["TenantType"]) {
  const sellable = plans.filter(
    (plan) =>
      plan.isActive &&
      (!plan.tenantType || plan.tenantType === type) &&
      plan.versions.some((v) => v.state === "published"),
  );
  const option = (plan: Schemas["PricePlanDto"]): PlanOption => ({ key: plan.key, name: plan.nameTh });
  return {
    plans: sellable.filter((plan) => plan.kind === "software").map(option),
    addons: sellable.filter((plan) => plan.kind !== "software").map(option),
  };
}

/**
 * A tenant's subscription (F5 5.1, D-082, D-204): plan and add-ons with their version, billing
 * period, trial end, pilot discount, the state and its history (`…/events`), and the actions the API
 * offers. Without a subscription: subscribe to a plan of the tenant's type.
 */
export async function TenantSubscription({
  context,
  tenant,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
}) {
  const t = await getTranslations("admin.tenants.subscription");
  const states = await getTranslations("status.subscription");
  const { api, locale, me } = context;
  const [list, plans] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { tenantId: tenant.id, perPage: 10 } } }))),
    section(unwrap(api.GET("/v1/admin/price-plans"))),
  ]);
  if (!list.data) return <SectionError error={list.error} />;
  const subscription =
    list.data.data.find((sub) => sub.state !== "cancelled") ??
    [...list.data.data].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ??
    null;
  const options = planOptions(plans.data ?? [], tenant.type);
  const manage = can(me, "admin.subscription.manage");

  if (!subscription) {
    return (
      <Card>
        <EmptyState
          variant="plain"
          icon={IconWallet}
          title={t("none")}
          description={t("noneHint")}
          action={
            manage && options.plans.length > 0 ? <SubscribeButton tenantId={tenant.id} {...options} /> : undefined
          }
        />
      </Card>
    );
  }

  const events = await section(
    unwrap(
      api.GET("/v1/admin/subscriptions/{subscriptionId}/events", {
        params: { path: { subscriptionId: subscription.id } },
      }),
    ),
  );
  const facts: Fact[] = [
    {
      key: "addons",
      label: t("addons"),
      value: subscription.addons.length ? subscription.addons.map((addon) => addon.nameTh).join(", ") : t("noAddons"),
    },
    { key: "period", label: t("billingPeriod"), value: t(`period.${subscription.billingPeriod}`) },
    { key: "started", label: t("started"), value: formatDate(subscription.startedAt, locale) },
    { key: "trial", label: t("trialEnds"), value: formatDateTime(subscription.trialEndsAt, locale) },
    {
      key: "activated",
      label: t("activated"),
      value: subscription.activatedAt ? formatDate(subscription.activatedAt, locale) : "—",
    },
    {
      key: "discount",
      label: t("discount"),
      value: subscription.discountPct !== "0.00" ? formatPercent(subscription.discountPct, locale) : "—",
      hint: subscription.discountPct !== "0.00" ? (subscription.discountReason ?? undefined) : undefined,
    },
    ...(subscription.pastDueSince
      ? [
          {
            key: "pastDue",
            label: t("pastDueSince"),
            value: formatDate(subscription.pastDueSince, locale),
            tone: "warning" as const,
          },
        ]
      : []),
    ...(subscription.suspendedAt
      ? [
          {
            key: "suspended",
            label: t("suspendedAt"),
            value: formatDateTime(subscription.suspendedAt, locale),
            tone: "danger" as const,
          },
        ]
      : []),
    ...(subscription.cancelEffectiveDate
      ? [
          {
            key: "cancel",
            label: t("cancelEffective"),
            value: formatDate(subscription.cancelEffectiveDate, locale),
            hint: subscription.cancelReason ?? undefined,
          },
        ]
      : []),
  ];
  return (
    <div data-testid="subscription" data-state={subscription.state}>
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            status={<StatusBadgeOf map={SUBSCRIPTION_STATUS} value={subscription.state} />}
            facts={[
              { key: "plan", label: t("plan"), value: subscription.plan.nameTh },
              { key: "version", label: t("version"), value: subscription.plan.version },
            ]}
            secondary={
              manage ? <SubscriptionActions subscription={subscription} slug={tenant.slug} {...options} /> : undefined
            }
          />
        }
      >
        {subscription.readOnly ? (
          <Callout tone="warning" title={t("readOnlyTitle")}>
            {t("readOnlyBody")}
          </Callout>
        ) : null}
        <Card as="section" aria-labelledby="subscription-card">
          <CardHeader
            title={<span id="subscription-card">{subscription.plan.nameTh}</span>}
            description={t("planVersionLine", { version: subscription.plan.version })}
          />
          <FactGrid facts={facts} label={subscription.plan.nameTh} />
        </Card>
        <Card as="section" aria-labelledby="subscription-events">
          <CardHeader title={<span id="subscription-events">{t("history")}</span>} />
          {events.data ? (
            events.data.length === 0 ? (
              <p className="text-muted">{t("noHistory")}</p>
            ) : (
              <Timeline
                events={events.data.map((event) => ({
                  id: event.id,
                  title: t.has(`event.${messageKey(event.type, "subscription.")}`)
                    ? t(`event.${messageKey(event.type, "subscription.")}`)
                    : event.type,
                  time: formatDateTime(event.occurredAt, locale),
                  description: describe(
                    event.data,
                    (value) => (states.has(value) ? states(value as Parameters<typeof states>[0]) : value),
                    (key) => (plans.data ?? []).find((one) => one.key === key)?.nameTh ?? key,
                  ),
                }))}
              />
            )
          ) : (
            <SectionError error={events.error} />
          )}
        </Card>
      </DetailLayout>
    </div>
  );
}

/** An event's data in words: the states by their names ("ทดลองใช้ → ใช้งานอยู่"), the plan by its name, the reason. */
function describe(
  data: Record<string, unknown>,
  state: (value: string) => string,
  plan: (key: string) => string,
): string | undefined {
  const parts: string[] = [];
  if (typeof data.from === "string" && typeof data.to === "string")
    parts.push(`${state(data.from)} → ${state(data.to)}`);
  if (typeof data.plan === "string") parts.push(plan(data.plan));
  if (typeof data.reason === "string" && data.reason) parts.push(data.reason);
  return parts.length ? parts.join(" · ") : undefined;
}
