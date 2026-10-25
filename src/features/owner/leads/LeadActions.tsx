"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { VIEWING_STATUS } from "@/domain/status/lead";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

type Lead = Schemas["OwnerLeadDto"];
type Viewing = Schemas["LeadViewingDto"];
type LostReason = Schemas["ListingLeadLostReason"];
const LOST_REASONS: LostReason[] = [
  "price",
  "location",
  "unit_unsuitable",
  "chose_other",
  "no_response",
  "not_qualified",
  "unit_leased",
  "other",
];
const LIVE = new Set<Viewing["state"]>(["requested", "confirmed"]);

/**
 * The viewings of an enquiry (F6.2 part 2, D-252), newest first: each with its time and state and only the
 * buttons that make sense now — confirm or decline a request, decline a confirmed one before it starts, record
 * how it went once it started. The API checks every step again.
 */
export function LeadViewings({ viewings, now }: { viewings: Viewing[]; now: number }) {
  const t = useTranslations("owner.leads.viewings");
  const locale = useLocale() as Locale;
  if (viewings.length === 0) return <p className="text-muted text-sm">{t("empty")}</p>;
  return (
    <ul className="divide-border m-0 flex list-none flex-col divide-y p-0" data-testid="lead-viewings">
      {viewings.map((viewing) => {
        const date = formatDateTime(viewing.startsAt, locale);
        const started = Date.parse(viewing.startsAt) <= now;
        const path = { params: { path: { viewingId: viewing.id } } };
        return (
          <li
            key={viewing.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
            data-testid="lead-viewing"
            data-state={viewing.state}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{date}</span>
              <StatusBadgeOf map={VIEWING_STATUS} value={viewing.state} size="sm" />
            </div>
            {viewing.note ? <p className="text-muted text-sm">{t("note", { note: viewing.note })}</p> : null}
            {viewing.reason ? <p className="text-muted text-sm">{t("reason", { reason: viewing.reason })}</p> : null}
            {viewing.rescheduledTo ? <p className="text-muted text-sm">{t("rescheduled")}</p> : null}
            {LIVE.has(viewing.state) && !started ? (
              <div className="flex flex-wrap gap-2">
                {viewing.state === "requested" ? (
                  <ConfirmAction
                    label={t("confirm")}
                    icon={IconCalendarCheck}
                    size="sm"
                    testId="viewing-confirm"
                    title={t("confirmTitle", { date })}
                    description={t("confirmBody")}
                    confirmLabel={t("confirm")}
                    successMessage={t("confirmed")}
                    onConfirm={() =>
                      unwrap(browserApi().POST("/v1/owner/listing-viewings/{viewingId}/actions/confirm", path))
                    }
                  />
                ) : null}
                <FormDialog
                  label={t("decline")}
                  icon={IconXCircle}
                  size="sm"
                  variant="ghost"
                  testId="viewing-decline"
                  title={t("declineTitle", { date })}
                  description={t("declineHint")}
                  submitLabel={t("decline")}
                  successMessage={t("declined")}
                  onSubmit={(data) =>
                    unwrap(
                      browserApi().POST("/v1/owner/listing-viewings/{viewingId}/actions/decline", {
                        ...path,
                        body: { reason: text(data, "reason") ?? "" },
                      }),
                    )
                  }
                >
                  {(errors) => (
                    <Field label={t("declineReason")} required error={errors.reason}>
                      <Textarea name="reason" rows={3} maxLength={500} required data-testid="viewing-decline-reason" />
                    </Field>
                  )}
                </FormDialog>
              </div>
            ) : null}
            {viewing.state === "confirmed" && started ? (
              <div className="flex flex-wrap gap-2">
                <ConfirmAction
                  label={t("viewed")}
                  icon={IconCheckCircle}
                  size="sm"
                  testId="viewing-viewed"
                  title={t("outcomeTitle", { date })}
                  description={t("viewedBody")}
                  confirmLabel={t("viewed")}
                  successMessage={t("recorded")}
                  onConfirm={() =>
                    unwrap(
                      browserApi().POST("/v1/owner/listing-viewings/{viewingId}/actions/complete", {
                        ...path,
                        body: { outcome: "completed" },
                      }),
                    )
                  }
                />
                <ConfirmAction
                  label={t("noShow")}
                  size="sm"
                  variant="ghost"
                  testId="viewing-no-show"
                  title={t("outcomeTitle", { date })}
                  description={t("noShowBody")}
                  confirmLabel={t("noShow")}
                  successMessage={t("recorded")}
                  onConfirm={() =>
                    unwrap(
                      browserApi().POST("/v1/owner/listing-viewings/{viewingId}/actions/complete", {
                        ...path,
                        body: { outcome: "no_show" },
                      }),
                    )
                  }
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** My private notes on an enquiry (never shown to the prospect). */
export function LeadNotes({ leadId, notes }: { leadId: string; notes: string | null }) {
  const t = useTranslations("owner.leads.notes");
  const action = useApiAction();
  const [value, setValue] = useState(notes ?? "");
  const [saved, setSaved] = useState(false);
  const save = () =>
    action.run(
      () =>
        unwrap(
          browserApi().PATCH("/v1/owner/leads/{leadId}", {
            params: { path: { leadId } },
            body: { notes: value.trim() || null },
          }),
        ),
      () => setSaved(true),
    );
  return (
    <div className="flex flex-col gap-2" data-testid="lead-notes">
      <Field label={t("title")} hint={t("hint")}>
        <Textarea
          rows={4}
          maxLength={2000}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          data-testid="lead-notes-input"
        />
      </Field>
      <ProblemNotice error={action.error} />
      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="text-muted text-sm" role="status">
            {t("saved")}
          </span>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={save}
          loading={action.busy}
          disabled={value === (notes ?? "")}
          data-testid="lead-notes-save"
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Where an enquiry stands (F6.2 part 2): the next steps as quiet buttons (contacted, viewed, applied), the
 * outcome as deliberate ones — won after a confirmation, lost with a reason the prospect never sees.
 */
export function LeadStateActions({ lead }: { lead: Lead }) {
  const t = useTranslations("owner.leads.state");
  const action = useApiAction();
  const [reason, setReason] = useState<LostReason>("chose_other");
  const name = lead.prospect.name;
  const move = (state: "contacted" | "viewed" | "applied") =>
    action.run(() =>
      unwrap(
        browserApi().POST("/v1/owner/leads/{leadId}/actions/set-state", {
          params: { path: { leadId: lead.id } },
          body: { state },
        }),
      ),
    );
  const steps = (["contacted", "viewed", "applied"] as const).filter((step) => step !== lead.state);

  return (
    <div className="flex flex-col gap-3" data-testid="lead-state-actions">
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <Button
            key={step}
            variant="secondary"
            size="sm"
            loading={action.busy}
            onClick={() => move(step)}
            data-testid={`lead-state-${step}`}
          >
            {t(step)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          label={t("won")}
          icon={IconCheckCircle}
          size="sm"
          testId="lead-won"
          title={t("wonTitle", { name })}
          description={t("wonBody")}
          confirmLabel={t("won")}
          successMessage={t("wonDone")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/leads/{leadId}/actions/set-state", {
                params: { path: { leadId: lead.id } },
                body: { state: "won" },
              }),
            )
          }
        />
        <FormDialog
          label={t("lost")}
          variant="ghost"
          size="sm"
          testId="lead-lost"
          title={t("lostTitle", { name })}
          description={t("lostHint")}
          submitLabel={t("lost")}
          successMessage={t("lostDone")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/leads/{leadId}/actions/set-state", {
                params: { path: { leadId: lead.id } },
                body: { state: "lost", lostReason: reason, lostNote: text(data, "lostNote") ?? null },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <Field label={t("lostReason")} required error={errors.lostReason}>
                <NativeSelect
                  value={reason}
                  onChange={(event) => setReason(event.target.value as LostReason)}
                  options={LOST_REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
                  data-testid="lead-lost-reason"
                />
              </Field>
              <Field label={t("lostNote")} error={errors.lostNote}>
                <Textarea name="lostNote" rows={2} maxLength={500} />
              </Field>
            </>
          )}
        </FormDialog>
      </div>
      <ProblemNotice error={action.error} />
    </div>
  );
}
