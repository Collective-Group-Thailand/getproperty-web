"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { bangkokInstant, bangkokLocal } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { problemKey, scheduleProblem } from "./broadcast";

/** The schedule / cancel refusals of G6 in the screen's own words (O-023, O-027, D-300) — a state, not an error. */
export function ScheduleRefusal({ error }: { error: unknown }) {
  const t = useTranslations("owner.broadcast.problems");
  const code = isApiError(error) ? scheduleProblem(error.code) : null;
  if (!code) return null;
  const key = problemKey(code);
  const tone = code === "broadcast.sponsored_disabled" || code === "broadcast.not_on_sale" ? "info" : "warning";
  return (
    <div className="mt-4" role="alert" data-testid="schedule-refusal" data-code={code}>
      <Callout tone={tone} title={t(`${key}.title`)}>
        {t(`${key}.body`)}
      </Callout>
    </div>
  );
}

/**
 * Schedules a draft (G6, D-300): now or a Bangkok date-time within 90 days. The dialog restates the estimated reach,
 * the price per recipient that is locked from now and the API's preview total; Idempotency-Key per opening. Refusals
 * — switched off (O-023), not on sale (O-027), below the minimum, a listing no longer public, already moved on — are
 * explained as states.
 */
export function ScheduleCampaign({
  campaignId,
  name,
  summary,
}: {
  campaignId: string;
  name: string;
  /** The restatement: reach, price per recipient and total incl. VAT, formatted on the server; null when unknown. */
  summary: { count: string; price: string; total: string | null } | null;
}) {
  const t = useTranslations("owner.broadcast.schedule");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState(
    () => bangkokLocal(new Date(Date.now() + 86_400_000).toISOString()).slice(0, 11) + "10:00",
  );
  const instant = when === "later" ? bangkokInstant(at) : undefined;
  return (
    <ConfirmAction
      label={t("action")}
      icon={IconCalendarCheck}
      testId="campaign-schedule"
      title={t("title", { name })}
      description={
        summary
          ? t("body", { count: summary.count, price: summary.price, total: summary.total ?? "none" })
          : t("bodyUnknown")
      }
      confirmLabel={t("confirm")}
      successMessage={t("done")}
      ready={when === "now" || Boolean(instant)}
      explain={(error) => (isApiError(error) && scheduleProblem(error.code) ? <ScheduleRefusal error={error} /> : null)}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/sponsored-campaigns/{campaignId}/actions/schedule", {
            params: { path: { campaignId }, header: { "Idempotency-Key": idempotencyKey } },
            body: { scheduledAt: instant ?? null },
          }),
        )
      }
    >
      <Field label={t("when")}>
        <RadioCards
          value={when}
          onValueChange={(value) => setWhen(value as "now" | "later")}
          options={[
            { value: "now", label: t("now"), description: t("nowHint") },
            { value: "later", label: t("later"), description: t("laterHint") },
          ]}
        />
      </Field>
      {when === "later" ? (
        <Field label={t("at")} required>
          <Input
            type="datetime-local"
            value={at}
            onChange={(event) => setAt(event.target.value)}
            data-testid="campaign-schedule-at"
          />
        </Field>
      ) : null}
    </ConfirmAction>
  );
}

/** Cancels a draft or scheduled campaign (nothing sent, nothing billed); `broadcast.invalid_state` explained. */
export function CancelCampaign({ campaignId, name }: { campaignId: string; name: string }) {
  const t = useTranslations("owner.broadcast.cancel");
  return (
    <ConfirmAction
      label={t("action")}
      icon={IconXCircle}
      variant="secondary"
      tone="destructive"
      testId="campaign-cancel"
      title={t("title", { name })}
      description={t("body")}
      confirmLabel={t("confirm")}
      successMessage={t("done")}
      explain={(error) => (isApiError(error) && scheduleProblem(error.code) ? <ScheduleRefusal error={error} /> : null)}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/sponsored-campaigns/{campaignId}/actions/cancel", {
            params: { path: { campaignId } },
          }),
        )
      }
    />
  );
}
