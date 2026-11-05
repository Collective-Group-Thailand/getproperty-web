"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconDevice } from "@/ui/icons/glyphs/device";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

const PIN = /^\d{4,6}$/;
const GATE_KINDS: Schemas["GateKind"][] = ["main", "side", "service"];

function GateFields({ errors, gate }: { errors: Record<string, string>; gate?: Schemas["GateDto"] }) {
  const t = useTranslations("owner.gate.gates");
  return (
    <>
      <Field label={t("name")} hint={t("nameHint")} required error={errors.name}>
        <Input name="name" required maxLength={120} defaultValue={gate?.name} data-testid="gate-name-input" />
      </Field>
      <Field label={t("kindLabel")} required error={errors.kind}>
        <NativeSelect
          name="kind"
          defaultValue={gate?.kind ?? "main"}
          options={GATE_KINDS.map((value) => ({ value, label: t(`kind.${value}`) }))}
        />
      </Field>
      {gate ? (
        <Field label={t("stateLabel")} error={errors.state}>
          <NativeSelect
            name="state"
            defaultValue={gate.state}
            options={(["active", "inactive"] as const).map((value) => ({ value, label: t(`state.${value}`) }))}
          />
        </Field>
      ) : null}
    </>
  );
}

export function NewGateButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations("owner.gate.gates");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant="primary"
      testId="gate-new"
      title={t("newTitle")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data, _ack, key) =>
        unwrap(
          browserApi().POST("/v1/owner/gates", {
            params: { header: { "Idempotency-Key": key } },
            body: {
              propertyId,
              name: text(data, "name") ?? "",
              kind: (text(data, "kind") ?? "main") as Schemas["GateKind"],
            },
          }),
        )
      }
    >
      {(errors) => <GateFields errors={errors} />}
    </FormDialog>
  );
}

export function EditGateButton({ gate }: { gate: Schemas["GateDto"] }) {
  const t = useTranslations("owner.gate.gates");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      testId="gate-edit"
      title={t("editTitle", { name: gate.name })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/owner/gates/{gateId}", {
            params: { path: { gateId: gate.id } },
            body: {
              name: text(data, "name"),
              kind: text(data, "kind") as Schemas["GateKind"],
              state: text(data, "state") as Schemas["ActiveStatus"],
            },
          }),
        )
      }
    >
      {(errors) => <GateFields errors={errors} gate={gate} />}
    </FormDialog>
  );
}

/**
 * A new tablet for a gate (J4.1 §1): the API answers with a one-time enrolment code — shown here once, with how to
 * use it on the tablet (`/gate`), and never again (it is stored hashed).
 */
export function NewTabletButton({ gate }: { gate: Schemas["GateDto"] }) {
  const t = useTranslations("owner.gate.gates");
  const router = useRouter();
  const [created, setCreated] = useState<Schemas["GateDeviceCreatedDto"] | null>(null);
  return (
    <>
      <FormDialog
        label={t("newTablet")}
        icon={IconDevice}
        size="sm"
        testId="tablet-new"
        title={t("newTabletTitle", { gate: gate.name })}
        description={t("newTabletLede")}
        submitLabel={t("createCode")}
        onSubmit={(data, _ack, key) => {
          const name = text(data, "name");
          if (!name) invalidField("name", t("tabletNameRequired"));
          return unwrap(
            browserApi().POST("/v1/owner/gates/{gateId}/devices", {
              params: { path: { gateId: gate.id }, header: { "Idempotency-Key": key } },
              body: { name },
            }),
          );
        }}
        onDone={(result) => setCreated(result as Schemas["GateDeviceCreatedDto"])}
      >
        {(errors) => (
          <Field label={t("tabletName")} hint={t("tabletNameHint")} required error={errors.name}>
            <Input name="name" required maxLength={120} data-testid="tablet-name" />
          </Field>
        )}
      </FormDialog>
      <LazyDialog
        open={created !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreated(null);
            router.refresh();
          }
        }}
        title={t("codeTitle")}
        description={t("codeLede")}
        closeLabel={t("close")}
        footer={
          <Button
            variant="secondary"
            iconStart={IconCopy}
            onClick={async () => {
              await navigator.clipboard?.writeText(created?.enrolCode ?? "").catch(() => undefined);
              toast.success(t("copied"));
            }}
          >
            {t("copy")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p
            className="rounded-card border-border bg-bg-subtle border px-4 py-5 text-center font-mono text-3xl font-semibold tracking-widest"
            data-testid="enrol-code-shown"
          >
            {created?.enrolCode}
          </p>
          <ol className="text-muted list-decimal ps-5 text-sm">
            <li>{t("codeStep1")}</li>
            <li>{t("codeStep2")}</li>
            <li>{t("codeStep3")}</li>
          </ol>
          <Callout tone="warning" size="sm">
            {t("codeOnce")}
          </Callout>
        </div>
      </LazyDialog>
    </>
  );
}

function ReasonField({
  value,
  onChange,
  min,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  min: number;
  testId?: string;
}) {
  const t = useTranslations("owner.gate");
  return (
    <Field label={t("reason.label")} hint={t("reason.min", { min })} required>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        maxLength={500}
        data-testid={testId}
      />
    </Field>
  );
}

export function RevokeTabletButton({ gateId, device }: { gateId: string; device: Schemas["GateDeviceDto"] }) {
  const t = useTranslations("owner.gate.gates");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("revokeTablet")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="tablet-revoke"
      title={t("revokeTabletTitle", { name: device.name })}
      description={t("revokeTabletBody")}
      confirmLabel={t("revokeTablet")}
      ready={reason.trim().length >= 3}
      successMessage={t("revokedTablet")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/gates/{gateId}/devices/{deviceId}/actions/revoke", {
            params: { path: { gateId, deviceId: device.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <ReasonField value={reason} onChange={setReason} min={3} />
    </ConfirmAction>
  );
}

/** Attach a barrier or LPR camera on one of the estate's edge gateways (J4.2 §2): channel unique per gateway. */
export function AttachEdgeButton({
  gateId,
  edgeOptions,
}: {
  gateId: string;
  edgeOptions: { value: string; label: string }[];
}) {
  const t = useTranslations("owner.gate.gates");
  const [kind, setKind] = useState<Schemas["GateHardwareKind"]>("barrier");
  return (
    <FormDialog
      label={t("attach")}
      icon={IconLink}
      size="sm"
      testId="edge-attach"
      title={t("attachTitle")}
      description={t("attachLede")}
      submitLabel={t("attachSubmit")}
      successMessage={t("attached")}
      disabled={edgeOptions.length === 0}
      onSubmit={(data, _ack, key) => {
        const edgeDeviceId = text(data, "edgeDeviceId");
        if (!edgeDeviceId) invalidField("edgeDeviceId", t("edgeRequired"));
        const channel = text(data, "channel") ?? "";
        if (!/^[A-Za-z0-9_.:-]{1,32}$/.test(channel)) invalidField("channel", t("channelInvalid"));
        const pulse = text(data, "pulseMs");
        return unwrap(
          browserApi().POST("/v1/owner/gates/{gateId}/edge-devices", {
            params: { path: { gateId }, header: { "Idempotency-Key": key } },
            body: {
              kind,
              name: text(data, "name") ?? "",
              edgeDeviceId,
              channel,
              ...(kind === "barrier" && pulse ? { pulseMs: Number(pulse) } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("hardwareKindLabel")} required>
            <NativeSelect
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as Schemas["GateHardwareKind"])}
              options={(["barrier", "lpr"] as const).map((value) => ({ value, label: t(`hardwareKind.${value}`) }))}
            />
          </Field>
          <Field label={t("hardwareName")} required error={errors.name}>
            <Input name="name" required maxLength={120} />
          </Field>
          <Field label={t("edgeGateway")} hint={t("edgeHint")} required error={errors.edgeDeviceId}>
            <NativeSelect name="edgeDeviceId" placeholder={t("edgePick")} options={edgeOptions} />
          </Field>
          <Field label={t("channel")} hint={t("channelHint")} required error={errors.channel}>
            <Input name="channel" required maxLength={32} className="font-mono" />
          </Field>
          {kind === "barrier" ? (
            <Field label={t("pulseLabel")} hint={t("pulseHint")} error={errors.pulseMs}>
              <Input name="pulseMs" type="number" min={200} max={10000} step={100} inputMode="numeric" />
            </Field>
          ) : null}
        </>
      )}
    </FormDialog>
  );
}

export function DetachEdgeButton({ gateId, device }: { gateId: string; device: Schemas["GateDeviceDto"] }) {
  const t = useTranslations("owner.gate.gates");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("detach")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="edge-detach"
      title={t("detachTitle", { name: device.name })}
      description={t("detachBody")}
      confirmLabel={t("detach")}
      ready={reason.trim().length >= 3}
      successMessage={t("detached")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/gates/{gateId}/edge-devices/{gateDeviceId}/actions/detach", {
            params: { path: { gateId, gateDeviceId: device.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <ReasonField value={reason} onChange={setReason} min={3} />
    </ConfirmAction>
  );
}

function PinField({ errors, label }: { errors: Record<string, string>; label: string }) {
  const t = useTranslations("owner.gate.guards");
  return (
    <Field label={label} hint={t("pinHint")} required error={errors.pin}>
      <Input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        required
        minLength={4}
        maxLength={6}
        className="font-mono"
        data-testid="guard-pin"
      />
    </Field>
  );
}

export function AddGuardButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations("owner.gate.guards");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant="primary"
      testId="guard-add"
      title={t("addTitle")}
      description={t("addLede")}
      submitLabel={t("addSubmit")}
      successMessage={t("added")}
      onSubmit={(data, _ack, key) => {
        const displayName = text(data, "displayName");
        if (!displayName) invalidField("displayName", t("nameRequired"));
        const pin = text(data, "pin") ?? "";
        if (!PIN.test(pin)) invalidField("pin", t("pinInvalid"));
        return unwrap(
          browserApi().POST("/v1/owner/gate-guards", {
            params: { header: { "Idempotency-Key": key } },
            body: { propertyId, displayName, pin },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("name")} hint={t("nameHint")} required error={errors.displayName}>
            <Input name="displayName" required maxLength={80} data-testid="guard-name" />
          </Field>
          <PinField errors={errors} label={t("pin")} />
        </>
      )}
    </FormDialog>
  );
}

/** A guard's row menu: rename, set a new PIN (ends a lockout), revoke (ends any open shift at once). */
export function GuardActions({ guard }: { guard: Schemas["GateGuardDto"] }) {
  const t = useTranslations("owner.gate.guards");
  const [reason, setReason] = useState("");
  return (
    <ActionMenu label={t("menu", { name: guard.displayName })} testId="guard-menu">
      <FormDialog
        label={t("rename")}
        icon={IconEdit}
        title={t("renameTitle")}
        submitLabel={t("save")}
        successMessage={t("saved")}
        onSubmit={(data) =>
          unwrap(
            browserApi().PATCH("/v1/owner/gate-guards/{guardId}", {
              params: { path: { guardId: guard.id } },
              body: { displayName: text(data, "displayName") },
            }),
          )
        }
      >
        {(errors) => (
          <Field label={t("name")} required error={errors.displayName}>
            <Input name="displayName" required maxLength={80} defaultValue={guard.displayName} />
          </Field>
        )}
      </FormDialog>
      <FormDialog
        label={t("resetPin")}
        icon={IconKey}
        title={t("resetPinTitle", { name: guard.displayName })}
        description={t("resetPinLede")}
        submitLabel={t("resetPin")}
        successMessage={t("pinReset")}
        onSubmit={(data, _ack, key) => {
          const pin = text(data, "pin") ?? "";
          if (!PIN.test(pin)) invalidField("pin", t("pinInvalid"));
          return unwrap(
            browserApi().POST("/v1/owner/gate-guards/{guardId}/actions/reset-pin", {
              params: { path: { guardId: guard.id }, header: { "Idempotency-Key": key } },
              body: { pin },
            }),
          );
        }}
      >
        {(errors) => <PinField errors={errors} label={t("newPin")} />}
      </FormDialog>
      <ConfirmAction
        label={t("revoke")}
        icon={IconXCircle}
        tone="destructive"
        title={t("revokeTitle", { name: guard.displayName })}
        description={t("revokeBody")}
        confirmLabel={t("revoke")}
        ready={reason.trim().length >= 3}
        successMessage={t("revoked")}
        onConfirm={(key) =>
          unwrap(
            browserApi().POST("/v1/owner/gate-guards/{guardId}/actions/revoke", {
              params: { path: { guardId: guard.id }, header: { "Idempotency-Key": key } },
              body: { reason: reason.trim() },
            }),
          )
        }
        onDone={() => setReason("")}
      >
        <ReasonField value={reason} onChange={setReason} min={3} />
      </ConfirmAction>
    </ActionMenu>
  );
}

/** A house's gate policy (J4.1 §2): the answer window, what happens after it, deliveries, the household note. */
export function PolicyForm({
  unitId,
  policy,
  disabled,
}: {
  unitId: string;
  policy: Schemas["HousePolicyDto"];
  disabled: boolean;
}) {
  const t = useTranslations("owner.gate.policies");
  const action = useApiAction();
  const [minutes, setMinutes] = useState(String(Math.round(policy.timeoutSeconds / 60)));
  const [choice, setChoice] = useState(policy.action);
  const [delivery, setDelivery] = useState<"estate" | "skip" | "ask">(
    policy.deliverySkipApproval === null ? "estate" : policy.deliverySkipApproval ? "skip" : "ask",
  );
  const [note, setNote] = useState(policy.householdNote ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      data-testid="policy-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const value = Number(minutes);
        if (!Number.isInteger(value) || value < 1 || value > 15) return setError(t("minutesInvalid"));
        setError(null);
        await action.run(
          () =>
            unwrap(
              browserApi().PUT("/v1/owner/gate-policies/units/{unitId}", {
                params: { path: { unitId } },
                body: {
                  timeoutSeconds: value * 60,
                  action: choice,
                  deliverySkipApproval: delivery === "estate" ? null : delivery === "skip",
                  householdNote: note.trim() || null,
                },
              }),
            ),
          () => {
            toast.success(t("saved"));
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("minutes")} hint={t("minutesHint")} required error={error ?? undefined}>
          <Input
            type="number"
            min={1}
            max={15}
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            disabled={disabled}
            data-testid="policy-minutes"
          />
        </Field>
        <Field label={t("action")} required>
          <NativeSelect
            value={choice}
            onChange={(event) => setChoice(event.target.value as Schemas["GatePolicyAction"])}
            disabled={disabled}
            options={(["guard_calls", "allow_and_log", "deny"] as const).map((value) => ({
              value,
              label: t(`actions.${value}`),
            }))}
          />
        </Field>
      </div>
      <Field label={t("delivery")}>
        <NativeSelect
          value={delivery}
          onChange={(event) => setDelivery(event.target.value as "estate" | "skip" | "ask")}
          disabled={disabled}
          options={(["estate", "skip", "ask"] as const).map((value) => ({
            value,
            label: t(`deliveryOption.${value}`),
          }))}
        />
      </Field>
      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          rows={2}
          disabled={disabled}
        />
      </Field>
      <ProblemNotice error={action.error} />
      {disabled ? null : (
        <div>
          <Button type="submit" loading={action.busy} data-testid="policy-save">
            {t("save")}
          </Button>
        </div>
      )}
    </form>
  );
}

export function BlacklistAddButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations("owner.gate.blacklist");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant="primary"
      testId="blacklist-add"
      title={t("addTitle")}
      description={t("addLede")}
      submitLabel={t("addSubmit")}
      successMessage={t("added")}
      onSubmit={(data, _ack, key) => {
        const category = text(data, "category") ?? "";
        const number = text(data, "number") ?? "";
        const province = text(data, "province") ?? "";
        const reason = text(data, "reason") ?? "";
        if (!category) invalidField("plate.category", t("categoryRequired"));
        if (!/^\d{1,4}$/.test(number)) invalidField("plate.number", t("numberInvalid"));
        if (!province) invalidField("plate.province", t("provinceRequired"));
        if (reason.length < 5) invalidField("reason", t("reasonRequired"));
        return unwrap(
          browserApi().POST("/v1/owner/gate-blacklist", {
            params: { header: { "Idempotency-Key": key } },
            body: { propertyId, plate: { category, number, province }, reason },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("category")} required error={errors["plate.category"]}>
              <Input name="category" required maxLength={4} className="font-mono" data-testid="blacklist-category" />
            </Field>
            <Field label={t("number")} required error={errors["plate.number"]}>
              <Input
                name="number"
                required
                maxLength={4}
                inputMode="numeric"
                className="font-mono"
                data-testid="blacklist-number"
              />
            </Field>
            <Field label={t("province")} required error={errors["plate.province"]}>
              <Input name="province" required maxLength={60} data-testid="blacklist-province" />
            </Field>
          </div>
          <Field label={t("reason")} hint={t("reasonHint")} required error={errors.reason}>
            <Textarea name="reason" required minLength={5} maxLength={500} rows={2} data-testid="blacklist-reason" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

export function BlacklistRevokeButton({ entry }: { entry: Schemas["BlacklistDto"] }) {
  const t = useTranslations("owner.gate.blacklist");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="blacklist-revoke"
      title={t("revokeTitle", { plate: `${entry.plate.category} ${entry.plate.number}` })}
      description={t("revokeBody")}
      confirmLabel={t("revoke")}
      ready={reason.trim().length >= 5}
      successMessage={t("revoked")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/gate-blacklist/{entryId}/actions/revoke", {
            params: { path: { entryId: entry.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <ReasonField value={reason} onChange={setReason} min={5} />
    </ConfirmAction>
  );
}

/** A contractor invite waiting for the office (J4.1 §3): approve (the QR starts working) or reject with a reason. */
export function InviteDecisionButtons({ invite }: { invite: Schemas["VisitInviteDto"] }) {
  const t = useTranslations("owner.gate.invites");
  const [reason, setReason] = useState("");
  return (
    <span className="flex flex-wrap justify-end gap-2">
      <ConfirmAction
        label={t("approve")}
        icon={IconCheckCircle}
        size="sm"
        testId="invite-approve"
        title={t("approveTitle", { unit: invite.unitNo ?? "—" })}
        description={t("approveBody", { name: invite.visitorName ?? "—" })}
        confirmLabel={t("approve")}
        successMessage={t("approved")}
        onConfirm={(key) =>
          unwrap(
            browserApi().POST("/v1/owner/gate-invites/{inviteId}/actions/approve", {
              params: { path: { inviteId: invite.id }, header: { "Idempotency-Key": key } },
            }),
          )
        }
      />
      <ConfirmAction
        label={t("reject")}
        icon={IconXCircle}
        variant="ghost"
        size="sm"
        tone="destructive"
        testId="invite-reject"
        title={t("rejectTitle", { unit: invite.unitNo ?? "—" })}
        description={t("rejectBody")}
        confirmLabel={t("reject")}
        ready={reason.trim().length === 0 || reason.trim().length >= 3}
        successMessage={t("rejected")}
        onConfirm={(key) =>
          unwrap(
            browserApi().POST("/v1/owner/gate-invites/{inviteId}/actions/reject", {
              params: { path: { inviteId: invite.id }, header: { "Idempotency-Key": key } },
              body: reason.trim() ? { reason: reason.trim() } : {},
            }),
          )
        }
        onDone={() => setReason("")}
      >
        <Field label={t("rejectReason")}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} />
        </Field>
      </ConfirmAction>
    </span>
  );
}

/** Acknowledge / resolve an SOS from the office (J4.2 §5); the note goes into the incident's timeline. */
export function IncidentDecisionButtons({ incident }: { incident: Schemas["IncidentDto"] }) {
  const t = useTranslations("owner.gate.incident");
  const [note, setNote] = useState("");
  const path = incident.state === "open" ? "acknowledge" : "resolve";
  return (
    <ConfirmAction
      label={t(path)}
      icon={IconCheckCircle}
      testId={`incident-${path}`}
      title={t(`${path}Title`)}
      description={t(`${path}Body`)}
      confirmLabel={t(path)}
      successMessage={t(`${path}d`)}
      onConfirm={() =>
        unwrap(
          path === "acknowledge"
            ? browserApi().POST("/v1/owner/incidents/{incidentId}/actions/acknowledge", {
                params: { path: { incidentId: incident.id } },
                body: note.trim() ? { note: note.trim() } : {},
              })
            : browserApi().POST("/v1/owner/incidents/{incidentId}/actions/resolve", {
                params: { path: { incidentId: incident.id } },
                body: note.trim() ? { note: note.trim() } : {},
              }),
        )
      }
      onDone={() => setNote("")}
    >
      <Field label={t("noteLabel")}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} />
      </Field>
    </ConfirmAction>
  );
}
