"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../../shared/links";

type Plan = Schemas["PaymentPlanDto"];

/** An account a plan may be proposed for: the API's receivable row (party × unit). */
export interface PlanCandidate {
  partyId: string;
  unitId: string;
  unitNo: string;
  ownerName: string;
  outstanding: string;
}

/**
 * Staff propose a plan of the party's open invoices of the unit (D-308): 2 … `juristic.plan_max_instalments` monthly
 * instalments from a first due date (default the 1st of next month, chosen by the API). The principal and the split
 * come from the API when it is approved — nothing is divided here.
 */
export function ProposePlanButton({
  candidates,
  maxInstalments,
  variant = "secondary",
  defaultOpen,
}: {
  candidates: PlanCandidate[];
  maxInstalments: number | null;
  variant?: "primary" | "secondary";
  defaultOpen?: boolean;
}) {
  const t = useTranslations("owner.collections.plan");
  const locale = useLocale() as Locale;
  const max = maxInstalments ?? 12;
  const single = candidates.length === 1 ? candidates[0]! : null;
  return (
    <FormDialog
      label={t("propose")}
      icon={IconRepeat}
      variant={variant}
      testId="plan-propose"
      title={single ? t("proposeTitleFor", { unit: single.unitNo }) : t("proposeTitle")}
      description={t("proposeBody")}
      submitLabel={t("proposeSubmit")}
      successMessage={t("proposed")}
      defaultOpen={defaultOpen}
      disabled={candidates.length === 0}
      onSubmit={(data, _ack, key) => {
        const chosen =
          single ??
          candidates.find((candidate) => `${candidate.partyId}:${candidate.unitId}` === text(data, "account"));
        if (!chosen) invalidField("account", t("accountRequired"));
        const instalments = Number(text(data, "instalments"));
        if (!Number.isInteger(instalments) || instalments < 2 || instalments > max)
          invalidField("instalments", t("instalmentsRange", { max }));
        const firstDueOn = text(data, "firstDueOn");
        const note = text(data, "note");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/payment-plans", {
            params: { header: { "Idempotency-Key": key } },
            body: {
              partyId: chosen.partyId,
              unitId: chosen.unitId,
              instalments,
              ...(firstDueOn ? { firstDueOn } : {}),
              ...(note ? { note } : {}),
            },
          }),
        );
      }}
      onDone={(result) => window.location.assign(ownerPath(locale, `/juristic/plans/${(result as Plan).id}`))}
    >
      {(errors) => (
        <>
          {single ? (
            <p className="m-0" data-testid="plan-account">
              {t("accountLine", {
                unit: single.unitNo,
                owner: single.ownerName,
                amount: formatTHB(single.outstanding, locale),
              })}
            </p>
          ) : (
            <Field label={t("account")} required error={errors.account}>
              <NativeSelect
                name="account"
                placeholder={t("accountPick")}
                options={candidates.map((candidate) => ({
                  value: `${candidate.partyId}:${candidate.unitId}`,
                  label: t("accountOption", {
                    unit: candidate.unitNo,
                    owner: candidate.ownerName,
                    amount: formatTHB(candidate.outstanding, locale),
                  }),
                }))}
                data-testid="plan-account-pick"
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("instalments")} hint={t("instalmentsHint", { max })} required error={errors.instalments}>
              <Input
                name="instalments"
                type="number"
                min={2}
                max={max}
                defaultValue={6}
                data-testid="plan-instalments"
              />
            </Field>
            <Field label={t("firstDue")} hint={t("firstDueHint")} error={errors.firstDueOn}>
              <DateField name="firstDueOn" defaultValue={null} />
            </Field>
          </div>
          <Field label={t("note")} hint={t("noteHint")} error={errors.note}>
            <Textarea name="note" rows={2} maxLength={500} />
          </Field>
          <p className="text-muted m-0 text-sm">{t("splitNote")}</p>
        </>
      )}
    </FormDialog>
  );
}

/** Explains the plan refusals in the screen's words; others fall back to the standard notice. */
function planProblem(error: unknown, t: ReturnType<typeof useTranslations>) {
  if (!isApiError(error)) return null;
  if (error.code === "payment_plan.nothing_due") return <Callout tone="info">{t("nothingDue")}</Callout>;
  if (error.code === "payment_plan.invalid_state") return <Callout tone="warning">{t("invalidState")}</Callout>;
  return null;
}

/**
 * Approves a proposed plan (owner, manager, committee — D-320): the balances open now become the principal, each
 * covered invoice gets a credit note and the principal is split by the API. Typed confirmation with the unit.
 */
export function ApprovePlanButton({ plan }: { plan: Plan }) {
  const t = useTranslations("owner.collections.plan");
  const locale = useLocale() as Locale;
  return (
    <ConfirmAction
      label={t("approve")}
      icon={IconCheckCircle}
      block
      testId="plan-approve"
      title={t("approveTitle", { unit: plan.unitNo })}
      description={t("approveBody", {
        owner: plan.partyName,
        amount: formatTHB(plan.proposedPrincipal, locale),
        count: plan.instalmentCount,
      })}
      confirmLabel={t("approve")}
      phrase={plan.unitNo}
      successMessage={t("approved")}
      explain={(error) => planProblem(error, t)}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/payment-plans/{planId}/actions/approve", {
            params: { path: { planId: plan.id }, header: { "Idempotency-Key": key } },
          }),
        )
      }
    />
  );
}

function ReasonAction({
  plan,
  action,
  tone,
}: {
  plan: Plan;
  action: "reject" | "cancel";
  tone: "destructive" | "primary";
}) {
  const t = useTranslations("owner.collections.plan");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t(action)}
      icon={IconXCircle}
      variant="secondary"
      tone={tone}
      block
      testId={`plan-${action}`}
      title={t(`${action}Title`, { unit: plan.unitNo })}
      description={plan.state === "active" && action === "cancel" ? t("cancelActiveBody") : t(`${action}Body`)}
      confirmLabel={t(action)}
      ready={reason.trim().length >= 3}
      successMessage={t(`${action}ed`)}
      explain={(error) => planProblem(error, t)}
      onConfirm={(key) =>
        action === "reject"
          ? unwrap(
              browserApi().POST("/v1/owner/juristic/payment-plans/{planId}/actions/reject", {
                params: { path: { planId: plan.id } },
                body: { reason: reason.trim() },
              }),
            )
          : unwrap(
              browserApi().POST("/v1/owner/juristic/payment-plans/{planId}/actions/cancel", {
                params: { path: { planId: plan.id }, header: { "Idempotency-Key": key } },
                body: { reason: reason.trim() },
              }),
            )
      }
      onDone={() => setReason("")}
    >
      <Field label={t("reason")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={500}
          data-testid={`plan-${action}-reason`}
        />
      </Field>
    </ConfirmAction>
  );
}

export function RejectPlanButton({ plan }: { plan: Plan }) {
  return <ReasonAction plan={plan} action="reject" tone="destructive" />;
}

export function CancelPlanButton({ plan }: { plan: Plan }) {
  return <ReasonAction plan={plan} action="cancel" tone="destructive" />;
}
