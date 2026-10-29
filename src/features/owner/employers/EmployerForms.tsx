"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { problemError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ExportButton } from "../shared/ExportButton";
import { ownerPath } from "../shared/links";
import { validDeductPercent, workersBody, type WorkerRow } from "./employer";

type Agreement = Schemas["EmployerAgreementDto"];
type SplitRule = Schemas["EmployerSplitRule"];
const SPLIT_RULES: SplitRule[] = ["per_occupant", "per_unit"];

/** A local field error in the API's problem shape, so the dialog shows it on its field without a request. */
function invalid(path: string, message: string): never {
  throw problemError(422, {
    status: 422,
    code: "validation.failed",
    title: message,
    errors: [{ path, code: "invalid", message }],
  });
}

function SplitRuleField({ defaultValue, error }: { defaultValue: SplitRule; error?: string }) {
  const t = useTranslations("owner.network.employers.form");
  return (
    <Field label={t("split")} hint={t(`splitHint.${defaultValue}`)} error={error}>
      <NativeSelect
        name="splitRule"
        defaultValue={defaultValue}
        options={SPLIT_RULES.map((rule) => ({ value: rule, label: t(`splitRule.${rule}`) }))}
        data-testid="employer-split"
      />
    </Field>
  );
}

/**
 * Record an employer agreement (G8, D-299): the employer is a company already among the tenant's people (invoices
 * of attached leases are addressed to it), optionally one building, how each invoice is split between the workers
 * and the share the employer recovers through payroll. Whether the employer may deduct from wages is its own
 * responsibility (O-034) — the dialog says so.
 */
export function NewAgreementButton({
  companies,
  buildings,
  defaultOpen,
}: {
  companies: { id: string; name: string }[];
  buildings: { id: string; name: string }[];
  defaultOpen?: boolean;
}) {
  const t = useTranslations("owner.network.employers.form");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant="primary"
      testId="employer-new"
      title={t("newTitle")}
      description={t("newHint")}
      submitLabel={t("create")}
      successMessage={t("created")}
      size_="lg"
      defaultOpen={defaultOpen}
      disabled={companies.length === 0}
      onSubmit={(data) => {
        const deduct = text(data, "deductPercent") ?? "100";
        if (!validDeductPercent(deduct)) invalid("deductPercent", t("deductInvalid"));
        return unwrap(
          browserApi().POST("/v1/owner/employer-agreements", {
            body: {
              employerPartyId: text(data, "employerPartyId") ?? "",
              buildingId: text(data, "buildingId") ?? null,
              splitRule: (text(data, "splitRule") as SplitRule | undefined) ?? "per_occupant",
              deductPercent: deduct,
              reference: text(data, "reference") ?? null,
              validFrom: text(data, "validFrom") ?? "",
              validTo: text(data, "validTo") ?? null,
            },
          }),
        );
      }}
      onDone={(result) => {
        const created = result as Agreement;
        window.location.assign(ownerPath(locale, `/employers/${created.id}`));
      }}
    >
      {(errors) => (
        <>
          <Field label={t("employer")} hint={t("employerHint")} error={errors.employerPartyId} required>
            <NativeSelect
              name="employerPartyId"
              required
              placeholder={t("employerPick")}
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              data-testid="employer-party"
            />
          </Field>
          <Field label={t("building")} hint={t("buildingHint")} error={errors.buildingId}>
            <NativeSelect
              name="buildingId"
              options={[
                { value: "", label: t("anyBuilding") },
                ...buildings.map((building) => ({ value: building.id, label: building.name })),
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <SplitRuleField defaultValue="per_occupant" error={errors.splitRule} />
            <Field label={t("deduct")} hint={t("deductHint")} error={errors.deductPercent}>
              <NumberInput
                name="deductPercent"
                inputMode="decimal"
                defaultValue="100"
                unit="%"
                data-testid="employer-deduct"
              />
            </Field>
            <Field label={t("validFrom")} error={errors.validFrom} required>
              <Input name="validFrom" type="date" required data-testid="employer-valid-from" />
            </Field>
            <Field label={t("validTo")} hint={t("validToHint")} error={errors.validTo}>
              <Input name="validTo" type="date" />
            </Field>
          </div>
          <Field label={t("reference")} hint={t("referenceHint")} error={errors.reference}>
            <Input name="reference" maxLength={120} data-testid="employer-reference" />
          </Field>
          <p className="text-muted m-0 text-sm">{t("deductDisclaimer")}</p>
        </>
      )}
    </FormDialog>
  );
}

/** Change the split, the deduction, the reference or the end date (If-Match: the version this page read). */
export function EditAgreementButton({ agreement, etag }: { agreement: Agreement; etag: string | null }) {
  const t = useTranslations("owner.network.employers.form");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      testId="employer-edit"
      title={t("editTitle", { name: agreement.employer.displayName })}
      description={t("editHint")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) => {
        const deduct = text(data, "deductPercent") ?? agreement.deductPercent;
        if (!validDeductPercent(deduct)) invalid("deductPercent", t("deductInvalid"));
        return unwrap(
          browserApi().PATCH("/v1/owner/employer-agreements/{agreementId}", {
            params: { path: { agreementId: agreement.id }, header: { "If-Match": etag ?? "*" } },
            body: {
              deductPercent: deduct,
              splitRule: (text(data, "splitRule") as SplitRule | undefined) ?? agreement.splitRule,
              reference: text(data, "reference") ?? null,
              validTo: text(data, "validTo") ?? null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SplitRuleField defaultValue={agreement.splitRule} error={errors.splitRule} />
            <Field label={t("deduct")} hint={t("deductHint")} error={errors.deductPercent}>
              <NumberInput name="deductPercent" inputMode="decimal" defaultValue={agreement.deductPercent} unit="%" />
            </Field>
            <Field label={t("validTo")} hint={t("validToHint")} error={errors.validTo}>
              <Input name="validTo" type="date" defaultValue={agreement.validTo ?? ""} />
            </Field>
            <Field label={t("reference")} error={errors.reference}>
              <Input name="reference" maxLength={120} defaultValue={agreement.reference ?? ""} />
            </Field>
          </div>
          <p className="text-muted m-0 text-sm">{t("nextInvoices")}</p>
        </>
      )}
    </FormDialog>
  );
}

/** End an agreement: its leases go back to their lessees for the next invoices; issued invoices never change (D-040). */
export function EndAgreementButton({ agreement, etag }: { agreement: Agreement; etag: string | null }) {
  const t = useTranslations("owner.network.employers.form");
  return (
    <ConfirmAction
      label={t("end")}
      icon={IconXCircle}
      variant="ghost"
      tone="destructive"
      testId="employer-end"
      title={t("endTitle", { name: agreement.employer.displayName })}
      description={t("endBody", { count: agreement.leaseIds.length })}
      confirmLabel={t("end")}
      phrase={agreement.employer.displayName}
      successMessage={t("ended")}
      onConfirm={() =>
        unwrap(
          browserApi().PATCH("/v1/owner/employer-agreements/{agreementId}", {
            params: { path: { agreementId: agreement.id }, header: { "If-Match": etag ?? "*" } },
            body: { end: true },
          }),
        )
      }
    />
  );
}

/** The workers' payroll numbers (what the employer's HR system knows them by) — one save for the whole list. */
export function WorkersEditor({
  agreementId,
  rows: initial,
  canManage,
}: {
  agreementId: string;
  rows: WorkerRow[];
  canManage: boolean;
}) {
  const t = useTranslations("owner.network.employers.workers");
  const action = useApiAction();
  const [rows, setRows] = useState(initial);
  const [saved, setSaved] = useState(false);
  if (rows.length === 0) return <p className="text-muted m-0 text-sm">{t("empty")}</p>;
  return (
    <div className="flex flex-col gap-3" data-testid="employer-workers">
      <ul className="divide-border m-0 list-none divide-y p-0">
        {rows.map((row, index) => (
          <li
            key={row.partyId}
            className="grid items-center gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_12rem]"
            data-testid="employer-worker"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.name}</span>
              <span className="text-muted text-xs">
                {row.unitNo ? t("unit", { unit: row.unitNo }) : t("notStaying")}
              </span>
            </span>
            <label className="flex flex-col gap-1 text-sm">
              <span className="sr-only">{t("number", { name: row.name })}</span>
              <Input
                value={row.employeeNo}
                placeholder={t("placeholder")}
                maxLength={40}
                disabled={!canManage}
                onChange={(event) => {
                  setSaved(false);
                  setRows(rows.map((one, i) => (i === index ? { ...one, employeeNo: event.target.value } : one)));
                }}
                data-testid="employer-worker-number"
              />
            </label>
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved ? (
            <span className="text-muted text-sm" role="status">
              {t("saved")}
            </span>
          ) : null}
          <Button
            loading={action.busy}
            onClick={() =>
              action.run(
                () =>
                  unwrap(
                    browserApi().PUT("/v1/owner/employer-agreements/{agreementId}/workers", {
                      params: { path: { agreementId } },
                      body: { workers: workersBody(rows) },
                    }),
                  ),
                () => setSaved(true),
              )
            }
            data-testid="employer-workers-save"
          >
            {t("save")}
          </Button>
        </div>
      ) : null}
      <ProblemNotice error={action.error} />
    </div>
  );
}

/** The month's payroll deduction file (CSV, built by the API's export worker, downloaded through the BFF). */
export function PayrollExportButton({ agreementId, month }: { agreementId: string; month: string }) {
  const t = useTranslations("owner.network.employers.statement");
  return (
    <ExportButton
      kind="payroll_deduction"
      params={{ employerAgreementId: agreementId, period: month }}
      label={t("payroll")}
      testId="employer-payroll"
      create={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/employer-agreements/{agreementId}/payroll-exports", {
            params: { path: { agreementId }, header: { "Idempotency-Key": idempotencyKey } },
            body: { month },
          }),
        )
      }
    />
  );
}

/**
 * Who pays a lease's invoices (G8): attach it to an employer agreement (invoices from now on are addressed to the
 * employer) or give it back to the lessee. Issued invoices never change (D-040).
 */
export function LeaseEmployerActions({
  leaseId,
  current,
  options,
}: {
  leaseId: string;
  current: { id: string; name: string } | null;
  options: { id: string; name: string }[];
}) {
  const t = useTranslations("owner.network.employers.lease");
  const put = (employerAgreementId: string | null) =>
    unwrap(
      browserApi().PUT("/v1/owner/leases/{leaseId}/employer", {
        params: { path: { leaseId } },
        body: { employerAgreementId },
      }),
    );
  return (
    <div className="flex flex-wrap gap-2">
      {options.length > 0 ? (
        <FormDialog
          label={current ? t("change") : t("attach")}
          icon={IconLease}
          size="sm"
          testId="lease-employer-attach"
          title={t("attachTitle")}
          description={t("attachHint")}
          submitLabel={t("attachSubmit")}
          successMessage={t("attached")}
          onSubmit={(data) => put(text(data, "employerAgreementId") ?? null)}
        >
          {(errors) => (
            <Field label={t("agreement")} error={errors.employerAgreementId} required>
              <NativeSelect
                name="employerAgreementId"
                required
                defaultValue={current?.id}
                placeholder={t("pick")}
                options={options.map((option) => ({ value: option.id, label: option.name }))}
                data-testid="lease-employer-pick"
              />
            </Field>
          )}
        </FormDialog>
      ) : null}
      {current ? (
        <ConfirmAction
          label={t("detach")}
          variant="ghost"
          size="sm"
          testId="lease-employer-detach"
          title={t("detachTitle", { name: current.name })}
          description={t("detachBody")}
          confirmLabel={t("detach")}
          successMessage={t("detached")}
          onConfirm={() => put(null)}
        />
      ) : null}
    </div>
  );
}
