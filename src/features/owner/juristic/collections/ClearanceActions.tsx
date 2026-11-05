"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError, problemError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../../shared/links";

type Clearance = Schemas["DebtClearanceDto"];

/** A co-owner of a unit today, as the register lists them. */
export interface ClearanceOwner {
  unitId: string;
  unitNo: string;
  partyId: string;
  partyName: string;
  building: string;
}

/**
 * The verification code of a certificate, shown once after it is issued (the API keeps a hash): the code, the public
 * check link it prints under the QR, and copy. Closing the dialog is the only way it leaves the screen.
 */
function VerifyCodeDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const t = useTranslations("owner.collections.clearance");
  const link = code ? `${window.location.origin}/verify/${code}` : "";
  return (
    <LazyDialog
      open={code !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("codeTitle")}
      closeLabel={t("close")}
    >
      {code ? (
        <div className="flex flex-col gap-4" data-testid="clearance-code">
          <p className="m-0">{t("codeBody")}</p>
          <div className="border-border bg-bg-subtle rounded-control flex items-center justify-between gap-3 border px-4 py-3">
            <span className="font-mono text-xl font-semibold tracking-widest" data-testid="clearance-code-value">
              {code}
            </span>
            <Button
              size="sm"
              variant="secondary"
              iconStart={IconCopy}
              onClick={() =>
                void navigator.clipboard?.writeText(code).then(
                  () => toast.success(t("copied")),
                  () => undefined,
                )
              }
              data-testid="clearance-code-copy"
            >
              {t("copy")}
            </Button>
          </div>
          <p className="text-muted m-0 text-sm break-all">{t("codeLink", { link })}</p>
          <Callout tone="info" size="sm">
            {t("codeOnce")}
          </Callout>
          <div className="flex justify-end">
            <Button onClick={onClose} data-testid="clearance-code-done">
              {t("done")}
            </Button>
          </div>
        </div>
      ) : null}
    </LazyDialog>
  );
}

/** Why the API would not issue: what is still owed (409 `debt_clearance.outstanding`, the amount in `outstanding`). */
function outstandingOf(error: unknown): string | null {
  return isApiError(error) && error.code === "debt_clearance.outstanding"
    ? (error.problem.outstanding ?? "0.00")
    : null;
}

/**
 * Asks for a certificate on behalf of a co-owner (D-306): as of today … +60 days. Issued only when nothing is
 * outstanding — otherwise the amount still owed is shown on the field and nothing is stored. With a fee the request
 * waits until the fee is paid; without one it is issued at once and its verification code is shown once.
 */
export function NewClearanceButton({ owners, today }: { owners: ClearanceOwner[]; today: string }) {
  const t = useTranslations("owner.collections.clearance");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState<string | null>(null);
  const [goTo, setGoTo] = useState<string | null>(null);
  return (
    <>
      <FormDialog
        label={t("new")}
        icon={IconAdd}
        variant="primary"
        testId="clearance-new"
        title={t("newTitle")}
        description={t("newBody")}
        submitLabel={t("newSubmit")}
        disabled={owners.length === 0}
        onSubmit={async (data, _ack, key) => {
          const chosen = owners.find((owner) => `${owner.partyId}:${owner.unitId}` === text(data, "owner"));
          if (!chosen)
            throw problemError(422, {
              code: "validation.failed",
              errors: [{ path: "owner", code: "required", message: t("ownerRequired") }],
            });
          const asOf = text(data, "asOf");
          try {
            return await unwrap(
              browserApi().POST("/v1/owner/juristic/debt-clearances", {
                params: { header: { "Idempotency-Key": key } },
                body: { unitId: chosen.unitId, partyId: chosen.partyId, ...(asOf ? { asOf } : {}) },
              }),
            );
          } catch (error) {
            const owed = outstandingOf(error);
            if (owed === null) throw error;
            // Shown on the field as a designed state: the amount still owed, nothing stored.
            throw problemError(409, {
              code: "debt_clearance.outstanding",
              errors: [
                { path: "owner", code: "outstanding", message: t("outstanding", { amount: formatTHB(owed, locale) }) },
              ],
            });
          }
        }}
        onDone={(result) => {
          const created = result as Clearance;
          const record = ownerPath(locale, `/juristic/debt-clearance/${created.id}`);
          if (created.verifyCode) {
            setGoTo(record);
            setCode(created.verifyCode);
          } else window.location.assign(record);
        }}
      >
        {(errors) => (
          <>
            <Field label={t("owner")} hint={t("ownerHint")} required error={errors.owner}>
              <NativeSelect
                name="owner"
                placeholder={t("ownerPick")}
                options={owners.map((owner) => ({
                  value: `${owner.partyId}:${owner.unitId}`,
                  label: t("ownerOption", { unit: owner.unitNo, owner: owner.partyName, building: owner.building }),
                }))}
                data-testid="clearance-owner"
              />
            </Field>
            <Field label={t("asOf")} hint={t("asOfHint")} error={errors.asOf}>
              <DateField name="asOf" defaultValue={today} />
            </Field>
          </>
        )}
      </FormDialog>
      <VerifyCodeDialog
        code={code}
        onClose={() => {
          setCode(null);
          if (goTo) window.location.assign(goTo);
        }}
      />
    </>
  );
}

/** Issues a requested certificate once its fee is paid (re-checked: 409 with the amount while anything is due). */
export function IssueClearanceButton({ clearance }: { clearance: Clearance }) {
  const t = useTranslations("owner.collections.clearance");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState<string | null>(null);
  return (
    <>
      <ConfirmAction
        label={t("issue")}
        icon={IconCheckCircle}
        block
        testId="clearance-issue"
        title={t("issueTitle", { unit: clearance.unitNo })}
        description={t("issueBody", { owner: clearance.partyName })}
        confirmLabel={t("issue")}
        phrase={clearance.unitNo}
        explain={(error) => {
          const owed = outstandingOf(error);
          return owed === null ? null : (
            <Callout tone="warning" title={t("outstandingTitle")} className="mt-4">
              <span data-testid="clearance-outstanding">{t("outstanding", { amount: formatTHB(owed, locale) })}</span>
            </Callout>
          );
        }}
        onConfirm={(key) =>
          unwrap(
            browserApi().POST("/v1/owner/juristic/debt-clearances/{debtClearanceId}/actions/issue", {
              params: { path: { debtClearanceId: clearance.id }, header: { "Idempotency-Key": key } },
            }),
          )
        }
        onDone={(result) => setCode((result as Clearance).verifyCode ?? null)}
      />
      <VerifyCodeDialog code={code} onClose={() => setCode(null)} />
    </>
  );
}

/** Refuses a request with a reason (its unpaid fee charge cancelled); the co-owner is told. */
export function RefuseClearanceButton({ clearance }: { clearance: Clearance }) {
  const t = useTranslations("owner.collections.clearance");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("refuse")}
      icon={IconXCircle}
      variant="secondary"
      tone="destructive"
      block
      testId="clearance-refuse"
      title={t("refuseTitle", { unit: clearance.unitNo })}
      description={t("refuseBody")}
      confirmLabel={t("refuse")}
      ready={reason.trim().length >= 3}
      successMessage={t("refused")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/debt-clearances/{debtClearanceId}/actions/refuse", {
            params: { path: { debtClearanceId: clearance.id } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <Field label={t("refuseReason")} hint={t("refuseReasonHint")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          data-testid="clearance-refuse-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
