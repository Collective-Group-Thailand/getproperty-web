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
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconSend } from "@/ui/icons/glyphs/send";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../shared/links";
import { contractProblem, PM_ROLES, staffProblemField, terminateWindow } from "./pm";

type Contract = Schemas["ManagementContractDto"];
export type ContractSide = "pm" | "juristic";
const REASON_MIN = 5;
const REASON_MAX = 1000;

const recordPath = (side: ContractSide, id: string) =>
  side === "pm" ? `/portfolio/contracts/${id}` : `/juristic/management-contracts/${id}`;

/** A refusal of a contract action in words with one next step; anything else → the API's own notice. */
export function ContractProblem({ error, contract, side }: { error: unknown; contract: Contract; side: ContractSide }) {
  const t = useTranslations("owner.pm.problem");
  const locale = useLocale() as Locale;
  if (!error) return null;
  const mapped = isApiError(error) ? contractProblem(error.code) : null;
  if (!mapped) return <ProblemNotice error={error} />;
  const href = mapped.next === "reload" ? ownerPath(locale, recordPath(side, contract.id)) : null;
  return (
    <div role="alert" data-testid="contract-problem" data-code={isApiError(error) ? error.code : undefined}>
      <Callout tone="warning" title={t(`${mapped.key}.title`)}>
        <p>{t(`${mapped.key}.body`, { juristic: contract.juristicName, building: contract.buildingName })}</p>
        {href ? (
          <a className="text-primary mt-1 inline-block font-medium underline-offset-4 hover:underline" href={href}>
            {t("reload")}
          </a>
        ) : null}
      </Callout>
    </div>
  );
}

/** `ConfirmAction.explain` for contract actions: a mapped refusal in words, else the dialog's own notice. */
function explainContract(contract: Contract, side: ContractSide) {
  return function explain(error: unknown): React.ReactNode {
    return isApiError(error) && contractProblem(error.code) ? (
      <ContractProblem error={error} contract={contract} side={side} />
    ) : null;
  };
}

/**
 * Accepts an offer (Idempotency-Key): the building becomes visible to the company from the start date through a read
 * grant on the juristic office's aggregates; refused after the start date (the office offers again).
 */
export function AcceptContractButton({ contract }: { contract: Contract }) {
  const t = useTranslations("owner.pm.accept");
  const locale = useLocale() as Locale;
  return (
    <ConfirmAction
      label={t("button")}
      block
      icon={IconCheckCircle}
      testId="contract-accept"
      title={t("title", { building: contract.buildingName })}
      description={t("body", {
        juristic: contract.juristicName,
        from: formatDate(contract.startsOn, locale),
        to: formatDate(contract.endsOn, locale),
      })}
      confirmLabel={t("confirm")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/pm/management-contracts/{contractId}/actions/accept", {
            params: { path: { contractId: contract.id }, header: { "Idempotency-Key": key } },
          }),
        )
      }
      explain={explainContract(contract, "pm")}
      successMessage={t("done")}
    />
  );
}

/** A reason dialog (5–1000) shared by decline (PM) and cancel (juristic office). */
function ReasonAction({
  contract,
  side,
  kind,
}: {
  contract: Contract;
  side: ContractSide;
  kind: "decline" | "cancel";
}) {
  const t = useTranslations(`owner.pm.${kind}`);
  const [reason, setReason] = useState("");
  const length = reason.trim().length;
  return (
    <ConfirmAction
      label={t("button")}
      variant="destructive"
      tone="destructive"
      block
      icon={kind === "decline" ? IconXCircle : IconClose}
      testId={`contract-${kind}`}
      title={t("title", { building: contract.buildingName })}
      description={t("body", { juristic: contract.juristicName, pm: contract.pmName })}
      confirmLabel={t("confirm")}
      ready={length >= REASON_MIN && length <= REASON_MAX}
      onConfirm={(key) =>
        unwrap(
          kind === "decline"
            ? browserApi().POST("/v1/owner/pm/management-contracts/{contractId}/actions/decline", {
                params: { path: { contractId: contract.id }, header: { "Idempotency-Key": key } },
                body: { reason: reason.trim() },
              })
            : browserApi().POST("/v1/owner/juristic/management-contracts/{contractId}/actions/cancel", {
                params: { path: { contractId: contract.id }, header: { "Idempotency-Key": key } },
                body: { reason: reason.trim() },
              }),
        )
      }
      explain={explainContract(contract, side)}
      successMessage={t("done")}
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid={`contract-${kind}-reason`}
        />
      </Field>
    </ConfirmAction>
  );
}

export function DeclineContractButton({ contract }: { contract: Contract }) {
  return <ReasonAction contract={contract} side="pm" kind="decline" />;
}

export function CancelContractButton({ contract }: { contract: Contract }) {
  return <ReasonAction contract={contract} side="juristic" kind="cancel" />;
}

/** The juristic office offers a draft (Idempotency-Key): the PM company then sees it and may accept until the start. */
export function OfferContractButton({ contract }: { contract: Contract }) {
  const t = useTranslations("owner.pm.offer");
  const locale = useLocale() as Locale;
  return (
    <ConfirmAction
      label={t("button")}
      block
      icon={IconSend}
      testId="contract-offer"
      title={t("title", { pm: contract.pmName })}
      description={t("body", { date: formatDate(contract.startsOn, locale) })}
      confirmLabel={t("confirm")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/management-contracts/{contractId}/actions/offer", {
            params: { path: { contractId: contract.id }, header: { "Idempotency-Key": key } },
          }),
        )
      }
      explain={explainContract(contract, "juristic")}
      successMessage={t("done")}
    />
  );
}

/**
 * Terminates a running contract from either side (Idempotency-Key): the first day without service (today … the end),
 * a reason and the typed phrase; access to the building ends then, fees stop, staff assignments end.
 */
export function TerminateContractButton({
  contract,
  side,
  today,
}: {
  contract: Contract;
  side: ContractSide;
  today: string;
}) {
  const t = useTranslations("owner.pm.terminate");
  const locale = useLocale() as Locale;
  const window = terminateWindow(contract, today);
  const [effectiveOn, setEffectiveOn] = useState(today);
  const [reason, setReason] = useState("");
  const length = reason.trim().length;
  const dateOk = effectiveOn >= window.min && effectiveOn <= window.max;
  return (
    <ConfirmAction
      label={t("button")}
      variant="destructive"
      tone="destructive"
      block
      icon={IconUndo}
      testId="contract-terminate"
      title={t("title", { building: contract.buildingName })}
      description={t(side === "pm" ? "bodyPm" : "bodyJuristic", { fees: contract.feesRequested })}
      confirmLabel={t("confirm")}
      phrase={t("phrase")}
      ready={length >= 3 && length <= REASON_MAX && dateOk}
      onConfirm={(key) => {
        const body = { reason: reason.trim(), effectiveOn };
        return unwrap(
          side === "pm"
            ? browserApi().POST("/v1/owner/pm/management-contracts/{contractId}/actions/terminate", {
                params: { path: { contractId: contract.id }, header: { "Idempotency-Key": key } },
                body,
              })
            : browserApi().POST("/v1/owner/juristic/management-contracts/{contractId}/actions/terminate", {
                params: { path: { contractId: contract.id }, header: { "Idempotency-Key": key } },
                body,
              }),
        );
      }}
      explain={explainContract(contract, side)}
      successMessage={t("done")}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("effectiveOn")}
          hint={t("effectiveOnHint", { from: formatDate(window.min, locale), to: formatDate(window.max, locale) })}
          required
          error={dateOk ? undefined : t("effectiveOnError")}
        >
          <Input
            type="date"
            min={window.min}
            max={window.max}
            value={effectiveOn}
            onChange={(event) => setEffectiveOn(event.target.value)}
            data-testid="contract-terminate-date"
          />
        </Field>
        <Field label={t("reason")} hint={t("reasonHint")} required>
          <Textarea
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-testid="contract-terminate-reason"
          />
        </Field>
      </div>
    </ConfirmAction>
  );
}

export interface AssignableBuilding {
  contractId: string;
  buildingName: string;
  startsOn: string;
  endsOn: string;
}

/**
 * Assigns a member to a managed building: building (its contract), member, role, shift, the first day and — optional —
 * the first day no longer there (exclusive, said in words). Refusals land on their field.
 */
export function AssignStaffButton({
  buildings,
  members,
  today,
  defaultContractId,
  defaultUserId,
  variant = "primary",
  label,
  testId = "staff-assign",
}: {
  buildings: AssignableBuilding[];
  members: { userId: string; displayName: string }[];
  today: string;
  defaultContractId?: string;
  defaultUserId?: string;
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
  testId?: string;
}) {
  const t = useTranslations("owner.pm.assign");
  const roles = useTranslations("owner.pm.role");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={label ?? t("button")}
      icon={IconAdd}
      variant={variant}
      size={variant === "ghost" ? "sm" : "md"}
      testId={testId}
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={async (data) => {
        const contractId = text(data, "contractId");
        const building = buildings.find((entry) => entry.contractId === contractId);
        if (!building) invalidField("contractId", t("error.building"));
        const userId = text(data, "userId");
        if (!userId) invalidField("userId", t("error.member"));
        const role = text(data, "role") as Schemas["PmAssignmentRole"] | undefined;
        if (!role) invalidField("role", t("error.role"));
        const startsOn = text(data, "startsOn");
        const endsOn = text(data, "endsOn");
        if (startsOn && endsOn && endsOn <= startsOn) invalidField("endsOn", t("error.endBeforeStart"));
        try {
          return await unwrap(
            browserApi().POST("/v1/owner/pm/staff-assignments", {
              body: {
                contractId: contractId!,
                userId: userId!,
                role: role!,
                shift: text(data, "shift") ?? null,
                ...(startsOn ? { startsOn } : {}),
                endsOn: endsOn ?? null,
                note: text(data, "note") ?? null,
              },
            }),
          );
        } catch (error) {
          const mapped = isApiError(error) ? staffProblemField(error.code) : null;
          if (mapped)
            invalidField(
              mapped.field,
              t(`error.${mapped.key}`, {
                from: formatDate(building!.startsOn, locale),
                to: formatDate(building!.endsOn, locale),
              }),
            );
          throw error;
        }
      }}
    >
      {(errors) => (
        <>
          <Field label={t("building")} required error={errors.contractId}>
            <NativeSelect
              name="contractId"
              defaultValue={defaultContractId ?? buildings[0]?.contractId}
              options={buildings.map((entry) => ({ value: entry.contractId, label: entry.buildingName }))}
              data-testid="staff-assign-building"
            />
          </Field>
          <Field label={t("member")} required error={errors.userId}>
            <NativeSelect
              name="userId"
              defaultValue={defaultUserId ?? ""}
              options={[
                { value: "", label: t("memberPick"), disabled: true },
                ...members.map((member) => ({ value: member.userId, label: member.displayName })),
              ]}
              data-testid="staff-assign-member"
            />
          </Field>
          <Field label={t("role")} required error={errors.role}>
            <NativeSelect
              name="role"
              defaultValue="building_manager"
              options={PM_ROLES.map((role) => ({ value: role, label: roles(role) }))}
              data-testid="staff-assign-role"
            />
          </Field>
          <Field label={t("shift")} hint={t("shiftHint")} error={errors.shift}>
            <Input name="shift" maxLength={100} data-testid="staff-assign-shift" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("startsOn")} hint={t("startsOnHint")} error={errors.startsOn}>
              <DateField name="startsOn" min={today} />
            </Field>
            <Field label={t("endsOn")} hint={t("endsOnHint")} error={errors.endsOn}>
              <DateField name="endsOn" min={today} />
            </Field>
          </div>
          <Field label={t("note")} error={errors.note}>
            <Textarea name="note" rows={2} maxLength={1000} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Ends an assignment: the first day no longer there (today by default, exclusive) — refused once already ended. */
export function EndAssignmentButton({
  assignmentId,
  name,
  building,
  today,
}: {
  assignmentId: string;
  name: string;
  building: string;
  today: string;
}) {
  const t = useTranslations("owner.pm.end");
  return (
    <FormDialog
      label={t("button")}
      variant="ghost"
      size="sm"
      testId="staff-end"
      title={t("title", { name, building })}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={async (data) => {
        const endsOn = text(data, "endsOn");
        try {
          return await unwrap(
            browserApi().POST("/v1/owner/pm/staff-assignments/{assignmentId}/actions/end", {
              params: { path: { assignmentId } },
              body: { endsOn: endsOn ?? null },
            }),
          );
        } catch (error) {
          if (isApiError(error) && error.code === "pm_staff.ended") invalidField("endsOn", t("ended"));
          throw error;
        }
      }}
    >
      {(errors) => (
        <Field label={t("endsOn")} hint={t("endsOnHint")} error={errors.endsOn}>
          <DateField name="endsOn" min={today} defaultValue={today} />
        </Field>
      )}
    </FormDialog>
  );
}
