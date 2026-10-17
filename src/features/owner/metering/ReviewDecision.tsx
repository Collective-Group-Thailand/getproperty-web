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
}: {
  review: Pick<Schemas["ReadingReviewDto"], "id" | "nextActions" | "unitNo" | "reading">;
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
    <div className="flex flex-wrap gap-2" data-testid="review-decision">
      <ConfirmAction
        label={t("accept")}
        icon={IconCheck}
        size="sm"
        testId="review-accept"
        title={t("acceptTitle")}
        description={t("acceptBody", subject)}
        confirmLabel={t("accept")}
        successMessage={t("accepted")}
        onConfirm={(key) => decide(key, { action: "accept" })}
      />
      <ConfirmAction
        label={t("correct")}
        icon={IconEdit}
        size="sm"
        variant="secondary"
        testId="review-correct"
        title={t("correctTitle")}
        description={t("correctBody", subject)}
        confirmLabel={t("correct")}
        ready={REGISTER.test(register) && note.trim().length > 0}
        successMessage={t("corrected")}
        onConfirm={(key) => decide(key, { action: "correct", register, note: note.trim() })}
      >
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
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} data-testid="review-note" />
        </Field>
      </ConfirmAction>
      <ConfirmAction
        label={t("reject")}
        icon={IconXCircle}
        size="sm"
        variant="ghost"
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
  );
}
