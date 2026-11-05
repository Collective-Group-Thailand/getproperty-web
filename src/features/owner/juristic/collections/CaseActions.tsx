"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDispute } from "@/ui/icons/glyphs/dispute";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

type Case = Schemas["CollectionCaseDto"];

function ReasonField({
  label,
  hint,
  value,
  onChange,
  testId,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <Field label={label} hint={hint} required>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={1000}
        data-testid={testId}
      />
    </Field>
  );
}

/**
 * Opens a dispute: the ladder pauses (no step runs) until it is closed, and the days paused move the rest back. The
 * resident is told (`juristic.collection.dispute_opened`); the reason stays on the case's evidence.
 */
export function OpenDisputeButton({ collectionCase, block }: { collectionCase: Case; block?: boolean }) {
  const t = useTranslations("owner.collections.case");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("openDispute")}
      icon={IconDispute}
      variant="secondary"
      block={block}
      testId="case-open-dispute"
      title={t("openDisputeTitle", { unit: collectionCase.unitNo })}
      description={t("openDisputeBody")}
      confirmLabel={t("openDispute")}
      ready={reason.trim().length >= 3}
      successMessage={t("disputeOpened")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/collection-cases/{caseId}/actions/open-dispute", {
            params: { path: { caseId: collectionCase.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <ReasonField
        label={t("disputeReason")}
        hint={t("disputeReasonHint")}
        value={reason}
        onChange={setReason}
        testId="case-dispute-reason"
      />
    </ConfirmAction>
  );
}

/** Closes the dispute with its outcome; the ladder resumes unless an active payment plan still holds it. */
export function CloseDisputeButton({ collectionCase, block }: { collectionCase: Case; block?: boolean }) {
  const t = useTranslations("owner.collections.case");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("closeDispute")}
      icon={IconCheckCircle}
      block={block}
      testId="case-close-dispute"
      title={t("closeDisputeTitle", { unit: collectionCase.unitNo })}
      description={collectionCase.planId ? t("closeDisputeBodyPlan") : t("closeDisputeBody")}
      confirmLabel={t("closeDispute")}
      ready={reason.trim().length >= 3}
      successMessage={t("disputeClosed")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/collection-cases/{caseId}/actions/close-dispute", {
            params: { path: { caseId: collectionCase.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <ReasonField
        label={t("disputeOutcome")}
        hint={t("disputeOutcomeHint")}
        value={reason}
        onChange={setReason}
        testId="case-dispute-outcome"
      />
    </ConfirmAction>
  );
}

/**
 * Approves the step the case waits on (owner, manager, committee — D-320): it runs now, its legal gate checked again by
 * the API (a closed gate records it skipped), and the ladder moves on.
 */
export function ApproveStepButton({ collectionCase, stepName }: { collectionCase: Case; stepName: string }) {
  const t = useTranslations("owner.collections.case");
  return (
    <ConfirmAction
      label={t("approveStep")}
      icon={IconCheckCircle}
      block
      testId="case-approve-step"
      title={t("approveStepTitle", { step: stepName, unit: collectionCase.unitNo })}
      description={t("approveStepBody")}
      confirmLabel={t("approveStep")}
      phrase={collectionCase.unitNo}
      successMessage={t("stepApproved")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/collection-cases/{caseId}/actions/approve-step", {
            params: { path: { caseId: collectionCase.id }, header: { "Idempotency-Key": key } },
            body: {},
          }),
        )
      }
    />
  );
}

/** Refuses the waiting step with a reason: it is recorded refused and the ladder moves to the next one. */
export function RefuseStepButton({ collectionCase, stepName }: { collectionCase: Case; stepName: string }) {
  const t = useTranslations("owner.collections.case");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("refuseStep")}
      icon={IconXCircle}
      variant="secondary"
      tone="destructive"
      block
      testId="case-refuse-step"
      title={t("refuseStepTitle", { step: stepName, unit: collectionCase.unitNo })}
      description={t("refuseStepBody")}
      confirmLabel={t("refuseStep")}
      ready={reason.trim().length >= 3}
      successMessage={t("stepRefused")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/collection-cases/{caseId}/actions/refuse-step", {
            params: { path: { caseId: collectionCase.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <ReasonField label={t("refuseReason")} value={reason} onChange={setReason} testId="case-refuse-reason" />
    </ConfirmAction>
  );
}
