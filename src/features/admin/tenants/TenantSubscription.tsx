import { getTranslations } from "next-intl/server";

import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatPercent } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
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
  return (
    <div className="flex flex-col gap-6" data-testid="subscription" data-state={subscription.state}>
      {subscription.readOnly ? (
        <Callout tone="warning" title={t("readOnlyTitle")}>
          {t("readOnlyBody")}
        </Callout>
      ) : null}
      <Card as="section" aria-labelledby="subscription-card">
        <CardHeader
          title={
            <span id="subscription-card" className="flex flex-wrap items-center gap-2">
              {subscription.plan.nameTh}
              <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={subscription.state} />
            </span>
          }
          description={t("planVersion", { key: subscription.plan.key, version: subscription.plan.version })}
          action={
            manage ? <SubscriptionActions subscription={subscription} slug={tenant.slug} {...options} /> : undefined
          }
        />
        <DescriptionList
          columns={3}
          items={[
            {
              id: "addons",
              term: t("addons"),
              description: subscription.addons.length
                ? subscription.addons.map((addon) => addon.nameTh).join(", ")
                : t("noAddons"),
            },
            { id: "period", term: t("billingPeriod"), description: t(`period.${subscription.billingPeriod}`) },
            { id: "started", term: t("started"), description: formatDate(subscription.startedAt, locale) },
            { id: "trial", term: t("trialEnds"), description: formatDateTime(subscription.trialEndsAt, locale) },
            {
              id: "activated",
              term: t("activated"),
              description: subscription.activatedAt ? formatDate(subscription.activatedAt, locale) : null,
            },
            {
              id: "discount",
              term: t("discount"),
              description:
                subscription.discountPct !== "0.00"
                  ? `${formatPercent(subscription.discountPct, locale)} · ${subscription.discountReason ?? ""}`
                  : null,
            },
            {
              id: "pastDue",
              term: t("pastDueSince"),
              description: subscription.pastDueSince ? formatDate(subscription.pastDueSince, locale) : null,
            },
            {
              id: "suspended",
              term: t("suspendedAt"),
              description: subscription.suspendedAt ? formatDateTime(subscription.suspendedAt, locale) : null,
            },
            {
              id: "cancel",
              term: t("cancelEffective"),
              description: subscription.cancelEffectiveDate
                ? `${formatDate(subscription.cancelEffectiveDate, locale)} · ${subscription.cancelReason ?? ""}`
                : null,
            },
          ]}
        />
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
                title: t.has(`event.${event.type}`) ? t(`event.${event.type}`) : event.type,
                time: formatDateTime(event.occurredAt, locale),
                description: describe(event.data),
              }))}
            />
          )
        ) : (
          <SectionError error={events.error} />
        )}
      </Card>
    </div>
  );
}

/** An event's data as the API sent it ("from → to", plan key, reason) — no interpretation. */
function describe(data: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (typeof data.from === "string" && typeof data.to === "string") parts.push(`${data.from} → ${data.to}`);
  if (typeof data.plan === "string") parts.push(data.plan);
  if (typeof data.reason === "string" && data.reason) parts.push(data.reason);
  return parts.length ? parts.join(" · ") : undefined;
}
