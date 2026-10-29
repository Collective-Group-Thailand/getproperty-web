"use client";

import { useTranslations } from "next-intl";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconFlag } from "@/ui/icons/glyphs/flag";

type Review = Schemas["OwnerReviewDto"];

/**
 * What an owner may do with a verified review (G9, D-301): write or edit one public reply (the API screens it for
 * phone numbers, links and accounts, like the review itself — its field error lands on the reply), and report it to
 * the getproperty moderators with a reason. There is deliberately no hide or delete: only the moderators decide.
 */
export function ReviewActions({ review }: { review: Review }) {
  const t = useTranslations("owner.insight.reviews.actions");
  const path = { params: { path: { reviewId: review.id } } };
  const canReply = review.state === "published";
  return (
    <div className="flex flex-wrap gap-2">
      {canReply ? (
        <FormDialog
          label={review.ownerReply ? t("editReply") : t("reply")}
          icon={IconChat}
          size="sm"
          testId="review-reply"
          title={review.ownerReply ? t("editReplyTitle") : t("replyTitle")}
          description={t("replyHint")}
          submitLabel={t("publishReply")}
          successMessage={t("replied")}
          onSubmit={(data) =>
            unwrap(
              browserApi().PUT("/v1/owner/reviews/{reviewId}/reply", {
                ...path,
                body: { reply: text(data, "reply") ?? "" },
              }),
            )
          }
        >
          {(errors) => (
            <Field label={t("replyLabel")} hint={t("replyRules")} error={errors.reply} required>
              <Textarea
                name="reply"
                rows={5}
                maxLength={1000}
                required
                defaultValue={review.ownerReply ?? ""}
                data-testid="review-reply-input"
              />
            </Field>
          )}
        </FormDialog>
      ) : null}
      {review.state === "published" && !review.reportedAt ? (
        <FormDialog
          label={t("report")}
          icon={IconFlag}
          size="sm"
          variant="ghost"
          testId="review-report"
          title={t("reportTitle")}
          description={t("reportHint")}
          submitLabel={t("sendReport")}
          successMessage={t("reported")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/reviews/{reviewId}/actions/report", {
                ...path,
                body: { reason: text(data, "reason") ?? "" },
              }),
            )
          }
        >
          {(errors) => (
            <Field label={t("reportReason")} hint={t("reportReasonHint")} error={errors.reason} required>
              <Textarea name="reason" rows={4} maxLength={1000} required data-testid="review-report-reason" />
            </Field>
          )}
        </FormDialog>
      ) : null}
    </div>
  );
}
