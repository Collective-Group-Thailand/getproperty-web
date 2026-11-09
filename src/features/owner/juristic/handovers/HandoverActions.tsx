"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice } from "@/features/shared/console/useApiAction";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconUndo } from "@/ui/icons/glyphs/undo";

import { ownerPath } from "../../shared/links";
import { handoverProblem, reasonOk, REASON_MAX } from "./handover";

type Review = Schemas["JuristicHandoverReviewDto"];
const LEGAL_FORMS: readonly Schemas["BuildingLegalForm"][] = [
  "condo_act",
  "land_allocation_act",
  "voluntary",
  "lease_contract",
];
const KINDS: readonly Schemas["PropertyKind"][] = [
  "condo",
  "village",
  "community",
  "office",
  "retail",
  "industrial",
  "mixed",
  "apartment",
];

/**
 * A refusal of a handover action in the office's words and the one next step (JW3b, `handoverProblem`); anything else
 * falls back to the API's own notice. A missing legal form is a field error of the acceptance, not a notice.
 */
export function HandoverProblem({ error, handoverId }: { error: unknown; handoverId: string }) {
  const t = useTranslations("owner.handovers.problem");
  const locale = useLocale() as Locale;
  if (!error) return null;
  const mapped = isApiError(error) ? handoverProblem(error.code) : null;
  if (!mapped) return <ProblemNotice error={error} />;
  const href =
    mapped.next === "reload"
      ? ownerPath(locale, `/juristic/handovers/${handoverId}`)
      : mapped.next === "register"
        ? ownerPath(locale, "/juristic/register")
        : null;
  return (
    <div role="alert" data-testid="handover-problem" data-code={isApiError(error) ? error.code : undefined}>
      <Callout tone="warning" title={t(`${mapped.key}.title`)}>
        <p>{t(`${mapped.key}.body`)}</p>
        {href ? (
          <a className="text-primary mt-1 inline-block font-medium underline-offset-4 hover:underline" href={href}>
            {t(`${mapped.key}.next`)}
          </a>
        ) : null}
        {isApiError(error) && error.requestId ? (
          <p className="text-muted mt-1 font-mono text-xs">{error.requestId}</p>
        ) : null}
      </Callout>
    </div>
  );
}

/** The legal form the API asks for when getbuild did not send one (`validation.failed` on `legalForm`). */
function legalFormMissing(error: unknown): boolean {
  return isApiError(error) && error.code === "validation.failed" && error.errors.some((e) => e.path === "legalForm");
}

/**
 * Accepts a handover (Idempotency-Key): the building's name typed; the legal form and the property kind only when the
 * developer did not send them (optional — the API says when one is needed); opening balances sent to their owners
 * unless the office turns it off. Disabled with its reason until the date has come and no problem remains.
 */
export function AcceptHandoverButton({ review, disabled }: { review: Review; disabled?: boolean }) {
  const t = useTranslations("owner.handovers.accept");
  const [legalForm, setLegalForm] = useState("");
  const [kind, setKind] = useState("");
  const [notify, setNotify] = useState(true);
  const [needsForm, setNeedsForm] = useState(false);
  return (
    <ConfirmAction
      label={t("button")}
      block
      icon={IconCheckCircle}
      disabled={disabled}
      testId="handover-accept"
      title={t("title", { building: review.buildingName })}
      description={t("body", {
        units: review.totals.units,
        owners: review.totals.parties,
        invoices: review.totals.receivableItems,
      })}
      confirmLabel={t("confirm")}
      phrase={review.buildingName}
      ready={!needsForm || !!legalForm}
      onConfirm={async (key) => {
        try {
          return await unwrap(
            browserApi().POST("/v1/owner/juristic/handovers/{handoverId}/actions/accept", {
              params: { path: { handoverId: review.id }, header: { "Idempotency-Key": key } },
              body: {
                ...(legalForm ? { legalForm: legalForm as Schemas["BuildingLegalForm"] } : {}),
                ...(kind ? { propertyKind: kind as Schemas["PropertyKind"] } : {}),
                notifyOpeningBalances: notify,
              },
            }),
          );
        } catch (error) {
          if (legalFormMissing(error)) setNeedsForm(true);
          throw error;
        }
      }}
      explain={(error) =>
        legalFormMissing(error) ? (
          <div role="alert" data-testid="handover-legal-form-needed">
            <Callout tone="warning" size="sm">
              {t("legalFormNeeded")}
            </Callout>
          </div>
        ) : isApiError(error) && handoverProblem(error.code) ? (
          <HandoverProblem error={error} handoverId={review.id} />
        ) : null
      }
      successMessage={t("done")}
    >
      <div className="flex flex-col gap-4">
        <ul className="text-muted m-0 flex list-disc flex-col gap-1 ps-5 text-sm" data-testid="handover-accept-effects">
          {(["register", "credits", "fund", "opening"] as const).map((effect) => (
            <li key={effect}>{t(`effect.${effect}`)}</li>
          ))}
        </ul>
        <Field
          label={t("legalForm")}
          hint={needsForm ? t("legalFormRequired") : t("legalFormHint")}
          required={needsForm}
          error={needsForm && !legalForm ? t("legalFormNeeded") : undefined}
        >
          <NativeSelect
            value={legalForm}
            onChange={(event) => setLegalForm(event.target.value)}
            options={[
              { value: "", label: t("asSent") },
              ...LEGAL_FORMS.map((form) => ({ value: form, label: t(`form.${form}`) })),
            ]}
            data-testid="handover-legal-form"
          />
        </Field>
        <Field label={t("kind")} hint={t("kindHint")}>
          <NativeSelect
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            options={[{ value: "", label: t("asSent") }, ...KINDS.map((k) => ({ value: k, label: t(`kindOf.${k}`) }))]}
            data-testid="handover-kind"
          />
        </Field>
        <Checkbox
          checked={notify}
          onCheckedChange={(checked) => setNotify(checked === true)}
          label={t("notify")}
          description={notify ? t("notifyOn") : t("notifyOff")}
          data-testid="handover-notify"
        />
      </div>
    </ConfirmAction>
  );
}

/** Rejects a handover (Idempotency-Key): the reason (5–1000) goes back to the developer; nothing is recorded. */
export function RejectHandoverButton({ review }: { review: Review }) {
  const t = useTranslations("owner.handovers.reject");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("button")}
      variant="destructive"
      tone="destructive"
      block
      icon={IconUndo}
      testId="handover-reject"
      title={t("title", { building: review.buildingName })}
      description={t("body")}
      confirmLabel={t("confirm")}
      ready={reasonOk(reason)}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/handovers/{handoverId}/actions/reject", {
            params: { path: { handoverId: review.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      explain={(error) =>
        isApiError(error) && handoverProblem(error.code) ? (
          <HandoverProblem error={error} handoverId={review.id} />
        ) : null
      }
      successMessage={t("done")}
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          rows={4}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid="handover-reject-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/**
 * Records the juristic person's formation (Idempotency-Key, once): the registration date (not after today) and its
 * number. While the developer operates the building, its period closes and the office's opens.
 */
export function JuristicFormedButton({
  review,
  today,
  variant = "primary",
}: {
  review: Review;
  today: string;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("owner.handovers.formed");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("button")}
      icon={IconFlag}
      variant={variant}
      testId="handover-formed"
      title={t("title", { building: review.buildingName })}
      description={review.developerTenantId ? t("bodyDeveloper") : t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={async (data, _ack, key) => {
        const formedOn = text(data, "formedOn");
        if (!formedOn) invalidField("formedOn", t("error.required"));
        if (formedOn! > today) invalidField("formedOn", t("error.future", { date: formatDate(today, locale) }));
        const registrationNo = text(data, "registrationNo");
        try {
          return await unwrap(
            browserApi().POST("/v1/owner/juristic/handovers/{handoverId}/actions/juristic-formed", {
              params: { path: { handoverId: review.id }, header: { "Idempotency-Key": key } },
              body: { formedOn: formedOn!, registrationNo: registrationNo ?? null },
            }),
          );
        } catch (error) {
          if (isApiError(error) && error.code === "handover.invalid_state")
            invalidField("formedOn", t("error.already"));
          throw error;
        }
      }}
    >
      {(errors) => (
        <>
          <Field label={t("formedOn")} hint={t("formedOnHint")} required error={errors.formedOn}>
            <DateField name="formedOn" max={today} />
          </Field>
          <Field label={t("registrationNo")} hint={t("registrationNoHint")} error={errors.registrationNo}>
            <Input name="registrationNo" maxLength={100} data-testid="handover-registration-no" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
