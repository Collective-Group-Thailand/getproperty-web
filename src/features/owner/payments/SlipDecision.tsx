"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { lazyWarm } from "@/ui/lib/lazy";

import { ConfirmAction } from "../shared/ConfirmAction";

const ImageViewer = lazyWarm(() => import("@/ui/components/ImageViewer").then((module) => module.ImageViewer));
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

/** The slip picture at full size with zoom (design-system.md §3 "SlipViewer"); the viewer loads on demand. */
export function SlipImage({ src, alt }: { src: string; alt: string }) {
  const photo = useTranslations("owner.common.photo");
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ImageViewer
        src={src}
        alt={alt}
        data-testid="slip-image"
        labels={{
          zoomIn: photo("zoomIn"),
          zoomOut: photo("zoomOut"),
          zoom: (percent) => photo("zoom", { percent }),
        }}
      />
    </Suspense>
  );
}

/**
 * Approve or reject a slip waiting for a person (D-043, D-198). Approval is a typed confirmation that
 * restates the unit and records the amount actually received (the detected amount is filled in); a
 * rejection needs its reason, which the resident sees. The API refuses a duplicate reference and a
 * partial payment when the tenant does not allow it.
 */
export function SlipDecision({
  slip,
  detectedLabel,
}: {
  slip: Pick<Schemas["SlipReviewDto"], "id" | "nextActions" | "unitNo" | "amountDetected" | "invoiceNumber">;
  detectedLabel: string;
}) {
  const t = useTranslations("owner.payments.slips.decide");
  const [amount, setAmount] = useState(slip.amountDetected ?? "");
  const [reason, setReason] = useState("");
  if (!slip.nextActions.includes("decide")) return null;
  const decide = (key: string, body: Schemas["SlipDecisionDto"]) =>
    unwrap(
      browserApi().POST("/v1/owner/slip-reviews/{slipReviewId}/actions/decide", {
        params: { path: { slipReviewId: slip.id }, header: { "Idempotency-Key": key } },
        body,
      }),
    );
  return (
    <div className="flex flex-wrap gap-2" data-testid="slip-decision">
      <ConfirmAction
        label={t("approve")}
        icon={IconCheck}
        testId="slip-approve"
        title={t("approveTitle")}
        description={t("approveBody", {
          unit: slip.unitNo ?? "—",
          invoice: slip.invoiceNumber ?? "—",
          detected: detectedLabel,
        })}
        confirmLabel={t("approve")}
        phrase={slip.unitNo ?? undefined}
        ready={MONEY.test(amount)}
        successMessage={t("approved")}
        onConfirm={(key) => decide(key, { action: "approve", amount })}
      >
        <Field label={t("amount")} hint={t("amountHint")}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            data-testid="slip-amount"
          />
        </Field>
      </ConfirmAction>
      <ConfirmAction
        label={t("reject")}
        icon={IconXCircle}
        variant="secondary"
        tone="destructive"
        testId="slip-reject"
        title={t("rejectTitle")}
        description={t("rejectBody", { unit: slip.unitNo ?? "—" })}
        confirmLabel={t("reject")}
        ready={reason.trim().length > 0}
        successMessage={t("rejected")}
        onConfirm={(key) => decide(key, { action: "reject", reason: reason.trim() })}
      >
        <Field label={t("reason")} required hint={t("reasonHint")}>
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-testid="slip-reject-reason"
          />
        </Field>
      </ConfirmAction>
    </div>
  );
}
