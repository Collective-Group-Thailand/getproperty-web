"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconUndo } from "@/ui/icons/glyphs/undo";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

type Review = Schemas["AdminReviewDto"];
type Action = "reject" | "hide";

/** "Decided in another tab" in words, for every moderation action (409 `review.invalid_state`). */
function explainState(message: string) {
  return function explain(error: unknown) {
    return isApiError(error) && error.code === "review.invalid_state" ? (
      <div className="mt-4" role="alert" data-testid="review-invalid-state">
        <Callout tone="warning">{message}</Callout>
      </div>
    ) : null;
  };
}

/** Reject (pending) or hide (published) with the reason the owner and the author read (≤ 1000 characters). */
function ReasonAction({ review, action }: { review: Review; action: Action }) {
  const t = useTranslations("admin.insight.reviews.actions");
  const [reason, setReason] = useState("");
  const path = { reviewId: review.id };
  return (
    <ConfirmAction
      label={t(action)}
      icon={action === "reject" ? IconXCircle : IconHide}
      size="sm"
      variant="secondary"
      tone="destructive"
      testId={`review-${action}`}
      title={t(`${action}Title`, { building: review.buildingName })}
      description={t(`${action}Body`)}
      confirmLabel={t(action)}
      successMessage={t(`${action}Done`)}
      ready={reason.trim().length > 0}
      explain={explainState(t("invalidState"))}
      onConfirm={(idempotencyKey) =>
        unwrap(
          action === "reject"
            ? browserApi().POST("/v1/admin/reviews/{reviewId}/actions/reject", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: reason.trim() },
              })
            : browserApi().POST("/v1/admin/reviews/{reviewId}/actions/hide", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: reason.trim() },
              }),
        )
      }
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          maxLength={1000}
          rows={4}
          onChange={(event) => setReason(event.target.value)}
          data-testid={`review-${action}-reason`}
        />
      </Field>
    </ConfirmAction>
  );
}

/**
 * The moderators' actions on a verified review (G9, D-301, O-035): approve or reject a pending one, hide a published
 * one for abuse and restore it, dismiss an owner's report. Every decision except the dismissal carries the dialog's
 * Idempotency-Key; a review decided elsewhere meanwhile is explained, not shown as an error.
 */
export function ReviewModeration({ review }: { review: Review }) {
  const t = useTranslations("admin.insight.reviews.actions");
  const path = { reviewId: review.id };
  return (
    <div className="flex flex-wrap gap-2">
      {review.state === "pending_moderation" ? (
        <>
          <ConfirmAction
            label={t("approve")}
            icon={IconCheckCircle}
            size="sm"
            testId="review-approve"
            title={t("approveTitle", { building: review.buildingName })}
            description={t("approveBody")}
            confirmLabel={t("approve")}
            successMessage={t("approveDone")}
            explain={explainState(t("invalidState"))}
            onConfirm={(idempotencyKey) =>
              unwrap(
                browserApi().POST("/v1/admin/reviews/{reviewId}/actions/approve", {
                  params: { path, header: { "Idempotency-Key": idempotencyKey } },
                }),
              )
            }
          />
          <ReasonAction review={review} action="reject" />
        </>
      ) : null}
      {review.state === "published" ? <ReasonAction review={review} action="hide" /> : null}
      {review.state === "hidden" ? (
        <ConfirmAction
          label={t("restore")}
          icon={IconUndo}
          size="sm"
          variant="secondary"
          testId="review-restore"
          title={t("restoreTitle", { building: review.buildingName })}
          description={t("restoreBody")}
          confirmLabel={t("restore")}
          successMessage={t("restoreDone")}
          explain={explainState(t("invalidState"))}
          onConfirm={(idempotencyKey) =>
            unwrap(
              browserApi().POST("/v1/admin/reviews/{reviewId}/actions/restore", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
              }),
            )
          }
        />
      ) : null}
      {review.reportedAt ? (
        <ConfirmAction
          label={t("dismiss")}
          size="sm"
          variant="ghost"
          testId="review-dismiss-report"
          title={t("dismissTitle")}
          description={t("dismissBody")}
          confirmLabel={t("dismiss")}
          successMessage={t("dismissDone")}
          explain={explainState(t("invalidState"))}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/admin/reviews/{reviewId}/actions/dismiss-report", { params: { path } }))
          }
        />
      ) : null}
    </div>
  );
}
