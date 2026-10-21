"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

export interface PlanOption {
  key: string;
  name: string;
}

function PlanFields({
  plans,
  addons,
  current,
  errors,
  withPeriod,
}: {
  plans: PlanOption[];
  addons: PlanOption[];
  current?: { plan: string; addons: string[] };
  errors: Record<string, string>;
  withPeriod?: boolean;
}) {
  const t = useTranslations("admin.tenants.subscription");
  return (
    <>
      <Field label={t("plan")} required error={errors.planKey}>
        <NativeSelect
          name="planKey"
          required
          defaultValue={current?.plan}
          options={plans.map((plan) => ({ value: plan.key, label: plan.name }))}
        />
      </Field>
      {addons.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">{t("addons")}</legend>
          {addons.map((addon) => (
            <Checkbox
              key={addon.key}
              name={`addon:${addon.key}`}
              label={addon.name}
              defaultChecked={current?.addons.includes(addon.key)}
            />
          ))}
        </fieldset>
      ) : null}
      {withPeriod ? (
        <Field label={t("billingPeriod")} error={errors.billingPeriod}>
          <NativeSelect
            name="billingPeriod"
            defaultValue="monthly"
            options={(["monthly", "annual"] as const).map((value) => ({ value, label: t(`period.${value}`) }))}
          />
        </Field>
      ) : null}
    </>
  );
}

const addonKeys = (data: FormData) =>
  [...data.keys()].filter((key) => key.startsWith("addon:") && data.get(key) === "on").map((key) => key.slice(6));

/** `POST /v1/admin/subscriptions` — subscribe a tenant to a published plan of its type; it starts in trial (D-082). */
export function SubscribeButton({
  tenantId,
  plans,
  addons,
}: {
  tenantId: string;
  plans: PlanOption[];
  addons: PlanOption[];
}) {
  const t = useTranslations("admin.tenants.subscription");
  return (
    <FormDialog
      label={t("subscribe")}
      icon={IconAdd}
      variant="primary"
      testId="subscribe"
      title={t("subscribeTitle")}
      description={t("subscribeHint")}
      submitLabel={t("subscribe")}
      successMessage={t("subscribed")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/subscriptions", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              tenantId,
              planKey: text(data, "planKey") ?? "",
              addonKeys: addonKeys(data),
              billingPeriod: (text(data, "billingPeriod") as Schemas["BillingPeriod"]) ?? "monthly",
            },
          }),
        )
      }
    >
      {(errors) => <PlanFields plans={plans} addons={addons} errors={errors} withPeriod />}
    </FormDialog>
  );
}

/**
 * The actions the API offers on a subscription (`nextActions`): change the plan or add-ons, suspend
 * (read-only tenant, D-082) and reinstate, cancel at the end of the month — each irreversible step
 * restates the tenant and asks for its slug typed back (00-master-plan.md §8).
 */
export function SubscriptionActions({
  subscription,
  slug,
  plans,
  addons,
}: {
  subscription: Schemas["SubscriptionDto"];
  slug: string;
  plans: PlanOption[];
  addons: PlanOption[];
}) {
  const t = useTranslations("admin.tenants.subscription");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);
  const path = { params: { path: { subscriptionId: subscription.id } } };
  const actions = new Set(subscription.nextActions);
  const reasonField = (id: string) => (
    <Field label={t("reason")} required>
      <Textarea
        name={id}
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        data-testid={`${id}-reason`}
      />
    </Field>
  );
  return (
    <div className="flex flex-wrap gap-2" data-testid="subscription-actions">
      {actions.has("change-plan") ? (
        <FormDialog
          label={t("changePlan")}
          icon={IconEdit}
          testId="change-plan"
          title={t("changePlanTitle", { name: subscription.tenantName })}
          submitLabel={t("changePlan")}
          successMessage={t("planChanged")}
          onSubmit={(data, _ackIds, idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/subscriptions/{subscriptionId}/actions/change-plan", {
                params: { ...path.params, header: { "Idempotency-Key": idempotencyKey } },
                body: {
                  planKey: text(data, "planKey") ?? "",
                  addonKeys: addonKeys(data),
                  reason: text(data, "reason") ?? null,
                },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <PlanFields
                plans={plans}
                addons={addons}
                errors={errors}
                current={{ plan: subscription.plan.key, addons: subscription.addons.map((addon) => addon.key) }}
              />
              <Field label={t("reason")} error={errors.reason}>
                <Textarea name="reason" rows={2} />
              </Field>
            </>
          )}
        </FormDialog>
      ) : null}
      {actions.has("suspend") ? (
        <ConfirmAction
          label={t("suspend")}
          icon={IconLock}
          variant="secondary"
          tone="destructive"
          testId="suspend"
          title={t("suspendTitle", { name: subscription.tenantName })}
          description={t("suspendBody", { name: subscription.tenantName })}
          confirmLabel={t("suspend")}
          phrase={slug}
          ready={reason.trim().length > 0}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/subscriptions/{subscriptionId}/actions/suspend", {
                params: { ...path.params, header: { "Idempotency-Key": idempotencyKey } },
                body: { confirm: slug, reason: reason.trim() },
              }),
            )
          }
          successMessage={t("suspended")}
        >
          {reasonField("suspend")}
        </ConfirmAction>
      ) : null}
      {actions.has("reinstate") ? (
        <ConfirmAction
          label={t("reinstate")}
          icon={IconUndo}
          variant="primary"
          testId="reinstate"
          title={t("reinstateTitle", { name: subscription.tenantName })}
          description={t("reinstateBody", { name: subscription.tenantName })}
          confirmLabel={t("reinstate")}
          phrase={slug}
          ready={reason.trim().length > 0}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/subscriptions/{subscriptionId}/actions/reinstate", {
                params: { ...path.params, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: reason.trim() },
              }),
            )
          }
          successMessage={t("reinstated")}
        >
          {reasonField("reinstate")}
        </ConfirmAction>
      ) : null}
      {actions.has("cancel") ? (
        <ConfirmAction
          label={t("cancel")}
          icon={IconXCircle}
          variant="secondary"
          tone="destructive"
          testId="cancel-subscription"
          title={t("cancelTitle", { name: subscription.tenantName })}
          description={t("cancelBody", { name: subscription.tenantName })}
          confirmLabel={t("cancel")}
          phrase={slug}
          ready={reason.trim().length > 0}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/subscriptions/{subscriptionId}/actions/cancel", {
                ...path,
                params: { ...path.params, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: reason.trim(), effectiveDate },
              }),
            )
          }
          successMessage={t("cancelled")}
        >
          {reasonField("cancel")}
          <Field label={t("effectiveDate")} hint={t("effectiveDateHint")}>
            <DateField name="effectiveDate" onChange={setEffectiveDate} />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}
