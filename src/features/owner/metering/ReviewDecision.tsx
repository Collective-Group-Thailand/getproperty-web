"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";

const REGISTER = /^\d{1,9}(\.\d{1,3})?$/;

/**
 * A reading the platform held for review (D-035): accept it, correct the register (the API refuses a
 * value below the previous reading) or reject it — corrections and rejections need a note. One
 * Idempotency-Key per decision.
 */
export function ReviewDecision({
  review,
  layout = "row",
  photo,
}: {
  review: Pick<Schemas["ReadingReviewDto"], "id" | "nextActions" | "unitNo" | "reading">;
  /**
   * `row`: a table row's quiet actions (outlined accept, text correct and reject); `bar`: the phone's bottom bar —
   * reject and correct outlined, accept filled and widest (G4).
   */
  layout?: "row" | "bar";
  /** The reading's photo, shown large in the correction dialog so the number can be read off it. */
  photo?: React.ReactNode;
}) {
  const t = useTranslations("owner.meters.reviews.decide");
  const [register, setRegister] = useState(review.reading.register);
  const [note, setNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  if (!review.nextActions.includes("decide")) return null;
  const decide = (key: string, body: Schemas["ReviewDecisionDto"]) =>
    unwrap(
      browserApi().POST("/v1/owner/meter-readings/reviews/{reviewId}/actions/decide", {
        params: { path: { reviewId: review.id }, header: { "Idempotency-Key": key } },
        body,
      }),
    );
  const subject = { meter: review.reading.meterCode, unit: review.unitNo ?? "—", register: review.reading.register };
  return (
    <div
      className={
        layout === "bar"
          ? "grid w-full grid-cols-[1fr_1fr_2fr] gap-2 [&_button]:w-full"
          : "flex flex-wrap items-center justify-end gap-1"
      }
      data-testid="review-decision"
    >
      <div className={layout === "bar" ? "order-3" : "contents"}>
        <ConfirmAction
          label={t("accept")}
          icon={IconCheck}
          size={layout === "bar" ? "md" : "sm"}
          variant={layout === "bar" ? "primary" : "secondary"}
          testId="review-accept"
          title={t("acceptTitle")}
          description={t("acceptBody", subject)}
          confirmLabel={t("accept")}
          successMessage={t("accepted")}
          onConfirm={(key) => decide(key, { action: "accept" })}
        />
      </div>
      <div className={layout === "bar" ? "order-2" : "contents"}>
        <ConfirmAction
          label={t("correct")}
          icon={layout === "bar" ? undefined : IconEdit}
          size={layout === "bar" ? "md" : "sm"}
          variant={layout === "bar" ? "secondary" : "ghost"}
          testId="review-correct"
          title={t("correctTitle")}
          description={t("correctBody", subject)}
          confirmLabel={t("correct")}
          ready={REGISTER.test(register) && note.trim().length > 0}
          successMessage={t("corrected")}
          onConfirm={(key) => decide(key, { action: "correct", register, note: note.trim() })}
        >
          {photo ? <div className="max-w-sm">{photo}</div> : null}
          <Field label={t("register")} hint={t("registerHint")}>
            <Input
              inputMode="decimal"
              className="font-mono"
              value={register}
              onChange={(event) => setRegister(event.target.value)}
              data-testid="review-register"
            />
          </Field>
          <Field label={t("note")} required>
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              data-testid="review-note"
            />
          </Field>
        </ConfirmAction>
      </div>
      <div className={layout === "bar" ? "order-1" : "contents"}>
        <ConfirmAction
          label={t("reject")}
          icon={layout === "bar" ? undefined : IconXCircle}
          size={layout === "bar" ? "md" : "sm"}
          variant={layout === "bar" ? "secondary" : "ghost"}
          tone="destructive"
          testId="review-reject"
          title={t("rejectTitle")}
          description={t("rejectBody", subject)}
          confirmLabel={t("reject")}
          ready={rejectNote.trim().length > 0}
          successMessage={t("rejected")}
          onConfirm={(key) => decide(key, { action: "reject", note: rejectNote.trim() })}
        >
          <Field label={t("note")} required>
            <Textarea
              rows={2}
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              data-testid="review-reject-note"
            />
          </Field>
        </ConfirmAction>
      </div>
    </div>
  );
}
