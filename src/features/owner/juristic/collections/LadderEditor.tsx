"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { MessagePreview } from "@/ui/components/MessagePreview";
import { StatusText } from "@/ui/components/StatusText";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
import { IconChevronUp } from "@/ui/icons/glyphs/chevron-up";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { cn } from "@/ui/lib/cn";

import {
  CHANNELS,
  draftOf,
  gateReasonKey,
  isDirty,
  ladderRefusal,
  refusedGateReason,
  stepErrors,
  stepLocks,
  stepPatch,
  toggleChannel,
  type LadderStep,
  type StepDraft,
} from "./ladder";
import { ChannelIcons } from "./parts";
import { ACTION_LOOK } from "./receivables";

/**
 * One step of the ladder (J-DESIGN §4 ladder editor): "+N วัน", the action, its channels and the template preview; a
 * legal measure counsel has not confirmed carries the lock and "ต้องให้ทนายยืนยันก่อนเปิดใช้" (O-038). Editing opens in
 * place: the offset between its neighbours, channels, approval (locked for the three forced measures), on / off
 * (locked while the API names a closed gate). The PATCH sends only what changed; the API's two refusals read as
 * designed states.
 */
export function LadderStepRow({
  ladderId,
  step,
  previous,
  next,
  last,
  canManage,
  officeName,
}: {
  ladderId: string;
  step: LadderStep;
  previous: LadderStep | undefined;
  next: LadderStep | undefined;
  last: boolean;
  canManage: boolean;
  officeName: string;
}) {
  const t = useTranslations("owner.collections");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StepDraft>(() => draftOf(step));
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const action = useApiAction();
  const locks = stepLocks(step);
  const errors = touched ? stepErrors(draft, previous, next) : {};
  const refusal = ladderRefusal(action.error);
  const refusedGate = gateReasonKey(refusedGateReason(action.error));
  const gate = gateReasonKey(step.gateClosedReason);
  const look = ACTION_LOOK[step.action];

  const save = () => {
    setTouched(true);
    if (Object.keys(stepErrors(draft, previous, next)).length) return;
    void action.run(
      () =>
        unwrap(
          browserApi().PATCH("/v1/owner/juristic/collection-ladders/{ladderId}/steps/{stepId}", {
            params: { path: { ladderId, stepId: step.id } },
            body: stepPatch(step, draft),
          }),
        ),
      () => {
        setEditing(false);
        setTouched(false);
        toast.success(t("ladder.saved"));
      },
    );
  };

  return (
    <li className="relative flex gap-4" data-testid="ladder-step" data-action={step.action} data-enabled={step.enabled}>
      {/* The rail: the step's number on a vertical line. */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums",
            step.enabled
              ? "border-primary bg-primary-subtle text-primary-subtle-fg"
              : "border-border bg-surface text-muted",
          )}
        >
          {step.seq}
        </span>
        {last ? null : <span aria-hidden="true" className="bg-border mt-1 w-px flex-1" />}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-3", last ? "pb-0" : "pb-7")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-lg font-semibold tabular-nums" data-testid="ladder-offset">
                {t("ladder.offset", { days: step.offsetDays })}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Icon icon={look.icon} size={16} />
                {t(`action.${step.action}`)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {step.enabled ? (
                <Badge tone="success" size="sm">
                  {t("ladder.on")}
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  {t("ladder.off")}
                </Badge>
              )}
              {step.requiresApproval ? (
                <Badge tone="neutral" size="sm">
                  {t("ladder.needsApproval")}
                </Badge>
              ) : null}
              {locks.legalLock ? (
                <span
                  className="text-muted inline-flex items-center gap-1 text-sm font-medium"
                  data-testid="ladder-legal-lock"
                >
                  <Icon icon={IconLock} size={14} />
                  {t("ladder.legalLock")}
                </span>
              ) : null}
            </div>
            {locks.legalLock && gate ? (
              <p className="text-muted m-0 text-sm" data-testid="ladder-gate-reason">
                {t(`gate.${gate}`)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <ChannelIcons channels={step.channels} />
            {canManage && !editing ? (
              <Button
                size="sm"
                variant="ghost"
                iconStart={IconEdit}
                onClick={() => {
                  setDraft(draftOf(step));
                  action.reset();
                  setEditing(true);
                }}
                data-testid="ladder-edit"
              >
                {t("ladder.edit")}
              </Button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="text-muted hover:text-fg inline-flex w-fit items-center gap-1 text-sm font-medium"
          aria-expanded={preview}
          onClick={() => setPreview((value) => !value)}
          data-testid="ladder-preview-toggle"
        >
          <Icon icon={preview ? IconChevronUp : IconChevronDown} size={14} />
          {t("ladder.preview")}
        </button>
        {preview ? (
          <MessagePreview
            label={t("ladder.preview")}
            sender={officeName}
            title={t(`ladder.template.${step.action}.title`)}
            body={t(`ladder.template.${step.action}.body`, { days: step.offsetDays })}
            note={
              step.action === "remind" || step.action === "surcharge"
                ? t("ladder.templateNote")
                : t("ladder.templateCounselNote")
            }
            className="max-w-xl"
            testId="ladder-preview"
          />
        ) : null}

        {editing ? (
          <div
            className="border-border bg-bg-subtle rounded-card flex flex-col gap-4 border p-4"
            data-testid="ladder-editor"
          >
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field
                label={t("ladder.offsetLabel")}
                hint={t("ladder.offsetHint", {
                  from: previous ? previous.offsetDays + 1 : 0,
                  to: next ? next.offsetDays - 1 : 3650,
                })}
                error={errors.offsetDays ? t(`ladder.error.${errors.offsetDays}`) : undefined}
                required
              >
                <Input
                  inputMode="numeric"
                  value={draft.offsetDays}
                  onChange={(event) => setDraft({ ...draft, offsetDays: event.target.value })}
                  onBlur={() => setTouched(true)}
                  data-testid="ladder-offset-input"
                />
              </Field>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 font-medium">{t("ladder.channels")}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {CHANNELS.map((channel) => (
                    <Checkbox
                      key={channel}
                      label={t(`channel.${channel}`)}
                      checked={draft.channels.includes(channel)}
                      onCheckedChange={() => {
                        setTouched(true);
                        setDraft({ ...draft, channels: toggleChannel(draft.channels, channel) });
                      }}
                      data-testid={`ladder-channel-${channel}`}
                    />
                  ))}
                </div>
                {errors.channels ? (
                  <StatusText tone="danger" icon={IconAlert}>
                    {t("ladder.error.channels")}
                  </StatusText>
                ) : null}
              </fieldset>
            </div>
            <Switch
              label={t("ladder.approval")}
              description={locks.approvalLocked ? t("ladder.approvalForced") : t("ladder.approvalHint")}
              checked={draft.requiresApproval}
              disabled={locks.approvalLocked}
              onCheckedChange={(value) => setDraft({ ...draft, requiresApproval: value })}
              data-testid="ladder-approval"
            />
            <Switch
              label={t("ladder.enabled")}
              description={
                locks.enableLocked ? (
                  <span className="inline-flex items-center gap-1">
                    <Icon icon={IconLock} size={14} />
                    {t("ladder.enableLocked")}
                  </span>
                ) : (
                  t("ladder.enabledHint")
                )
              }
              checked={draft.enabled}
              disabled={locks.enableLocked}
              onCheckedChange={(value) => setDraft({ ...draft, enabled: value })}
              data-testid="ladder-enabled"
            />
            {refusal === "legal" ? (
              <Callout tone="neutral" title={t("ladder.refusedLegalTitle")}>
                <p>{t("ladder.refusedLegal")}</p>
                {refusedGate ? <p data-testid="ladder-refused-gate">{t(`gate.${refusedGate}`)}</p> : null}
              </Callout>
            ) : refusal === "approval" ? (
              <Callout tone="neutral" title={t("ladder.refusedApprovalTitle")}>
                {t("ladder.refusedApproval")}
              </Callout>
            ) : (
              <ProblemNotice error={action.error} />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setTouched(false);
                  setDraft(draftOf(step));
                }}
                disabled={action.busy}
              >
                {t("ladder.cancel")}
              </Button>
              <Button onClick={save} loading={action.busy} disabled={!isDirty(step, draft)} data-testid="ladder-save">
                {t("ladder.save")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** A ladder as a vertical list of its steps (one per legal form of the tenant's buildings). */
export function LadderSteps({
  ladder,
  canManage,
  officeName,
}: {
  ladder: Schemas["CollectionLadderDto"];
  canManage: boolean;
  officeName: string;
}) {
  return (
    <ol className="m-0 flex list-none flex-col p-0" data-testid="ladder-steps" data-form={ladder.legalForm}>
      {ladder.steps.map((step, index) => (
        <LadderStepRow
          key={`${step.id}-${step.version}`}
          ladderId={ladder.id}
          step={step}
          previous={ladder.steps[index - 1]}
          next={ladder.steps[index + 1]}
          last={index === ladder.steps.length - 1}
          canManage={canManage}
          officeName={officeName}
        />
      ))}
    </ol>
  );
}
