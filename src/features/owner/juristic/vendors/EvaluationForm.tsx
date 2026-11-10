"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction, useSubmissionKey } from "@/features/shared/console/useApiAction";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { ErrorSummary } from "@/ui/components/ErrorSummary";
import { Field } from "@/ui/components/Field";
import { FieldError } from "@/ui/components/FieldError";
import { FormColumns, FormSection, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { StatusText } from "@/ui/components/StatusText";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { cn } from "@/ui/lib/cn";

import { ownerPath } from "../../shared/links";
import { SCORES, type Criterion } from "./evaluations";

/**
 * The monthly evaluation (D-331) as a form: the month, one 1–5 scale per criterion of
 * `juristic.vendor_evaluation_criteria`, incidents and notes. The month's SLA breaches come from the vendor's work
 * orders — shown read-only, the API snapshots them with the evaluation. An evaluation cannot be changed once saved, so
 * the summary says so beside the button; the average is the API's.
 */
export function EvaluationForm({
  contractId,
  month,
  months,
  criteria,
  sla,
  slaFailed,
}: {
  contractId: string;
  month: string;
  months: { value: string; label: string }[];
  criteria: Criterion[];
  sla: Schemas["SlaMonthDto"] | null;
  slaFailed: boolean;
}) {
  const t = useTranslations("owner.vendors.evaluate");
  const kinds = useTranslations("owner.vendors.contract.breachKind");
  const priorities = useTranslations("status.priority");
  const locale = useLocale() as Locale;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [incidents, setIncidents] = useState("0");
  const [incidentNote, setIncidentNote] = useState("");
  const [note, setNote] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const submission = useSubmissionKey();
  const action = useApiAction<Schemas["VendorEvaluationDto"]>({ refresh: false });
  const label = (criterion: Criterion) => (locale === "th" ? criterion.labelTh : criterion.labelEn);
  const scored = criteria.filter((criterion) => scores[criterion.key] !== undefined).length;

  const submit = () => {
    const found: Record<string, string> = {};
    for (const criterion of criteria)
      if (scores[criterion.key] === undefined)
        found[`score-${criterion.key}`] = t("error.score", { criterion: label(criterion) });
    const count = Number(incidents);
    if (!Number.isInteger(count) || count < 0 || count > 1000) found["evaluation-incidents"] = t("error.incidents");
    setLocal(found);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length) return;
    const body = {
      month,
      scores: criteria.map((criterion) => ({ criterion: criterion.key, score: scores[criterion.key]! })),
      incidents: count,
      ...(incidentNote.trim() ? { incidentNote: incidentNote.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/vendor-contracts/{contractId}/evaluations", {
            params: { path: { contractId }, header: { "Idempotency-Key": submission.for(body) } },
            body,
          }),
        ),
      () => {
        submission.answered();
        window.location.assign(ownerPath(locale, `/juristic/contracts/${contractId}#evaluations`));
      },
    );
  };

  const save = (testId: string) => (
    <Button onClick={submit} loading={action.busy} data-testid={testId}>
      {t("save")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: Object.keys(local).length })}
        items={Object.entries(local).map(([key, message]) => ({ fieldId: key, message }))}
        focusKey={attempt}
        testId="evaluation-errors"
      />
      <FormColumns
        summary={
          <FormSummary
            title={t("summary.title")}
            rows={[
              { key: "month", label: t("summary.month"), value: months.find((entry) => entry.value === month)?.label },
              {
                key: "scored",
                label: t("summary.scored"),
                value: t("summary.scoredValue", { scored, total: criteria.length }),
              },
              {
                key: "breaches",
                label: t("summary.breaches"),
                value: sla ? t("summary.breachesValue", { count: sla.breaches.length }) : "—",
              },
            ]}
            action={save("evaluation-save")}
            note={
              <span className="flex items-start gap-2">
                <span>{t("summary.note")}</span>
              </span>
            }
          />
        }
      >
        <FormSection number={1} title={t("section.month")} description={t("section.monthHint")}>
          <Field label={t("month")} className="sm:max-w-xs">
            <NativeSelect
              value={month}
              onChange={(event) =>
                window.location.assign(
                  ownerPath(locale, `/juristic/contracts/${contractId}/evaluate?month=${event.target.value}`),
                )
              }
              options={months}
              data-testid="evaluation-month"
            />
          </Field>
        </FormSection>

        <FormSection number={2} title={t("section.scores")} description={t("section.scoresHint")}>
          <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2" data-testid="evaluation-scores">
            {criteria.map((criterion) => {
              const error = local[`score-${criterion.key}`];
              return (
                <fieldset
                  key={criterion.key}
                  className="m-0 flex flex-col gap-2 border-0 p-0"
                  aria-describedby={error ? `score-${criterion.key}` : undefined}
                  data-testid="evaluation-criterion"
                >
                  <legend className="mb-2 font-medium">{label(criterion)}</legend>
                  <div className="flex items-center gap-2" role="radiogroup" aria-label={label(criterion)}>
                    {SCORES.map((score) => {
                      const checked = scores[criterion.key] === score;
                      return (
                        <label
                          key={score}
                          className={cn(
                            "rounded-control flex size-11 cursor-pointer items-center justify-center border text-base font-semibold tabular-nums",
                            "has-[:focus-visible]:outline-focus-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                            checked
                              ? "border-primary bg-primary text-primary-fg"
                              : "border-border-strong bg-surface hover:bg-bg-subtle",
                          )}
                        >
                          <input
                            type="radio"
                            name={`score-${criterion.key}`}
                            value={score}
                            checked={checked}
                            onChange={() => setScores((all) => ({ ...all, [criterion.key]: score }))}
                            className="sr-only"
                            data-testid={`score-${criterion.key}-${score}`}
                          />
                          {score}
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-muted flex w-[15.75rem] justify-between text-sm" aria-hidden="true">
                    <span>{t("low")}</span>
                    <span>{t("high")}</span>
                  </div>
                  {error ? <FieldError id={`score-${criterion.key}`}>{error}</FieldError> : null}
                </fieldset>
              );
            })}
          </div>
        </FormSection>

        <FormSection number={3} title={t("section.sla")} description={t("section.slaHint")}>
          {slaFailed ? (
            <Callout tone="warning" title={t("slaFailedTitle")}>
              {t("slaFailed")}
            </Callout>
          ) : sla ? (
            <div className="bg-bg-subtle rounded-control flex flex-col gap-3 p-4" data-testid="evaluation-sla">
              <StatusText tone="muted" icon={IconLock} size="sm">
                {t("slaPulled", { orders: sla.workOrders })}
              </StatusText>
              {sla.breaches.length === 0 ? (
                <StatusText tone="success" icon={IconCheckCircle}>
                  {t("slaNone")}
                </StatusText>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {sla.breaches.map((item, index) => (
                    <li
                      key={`${item.workOrderId}-${item.kind}-${index}`}
                      className="border-border bg-surface rounded-control flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border px-3 py-2"
                      data-testid="evaluation-breach"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-muted text-sm">
                          {kinds(item.kind)} · {priorities(item.priority)}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums">
                        {item.allowedHours !== null && item.actualHours !== null
                          ? t("hoursOf", { actual: Number(item.actualHours.toFixed(2)), allowed: item.allowedHours })
                          : t("requestSla")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <Field label={t("incidents")} hint={t("incidentsHint")} error={local["evaluation-incidents"]}>
              <Input
                id="evaluation-incidents"
                value={incidents}
                onChange={(event) => setIncidents(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="tabular-nums"
                data-testid="evaluation-incidents"
              />
            </Field>
            <Field label={t("incidentNote")}>
              <Textarea
                value={incidentNote}
                onChange={(event) => setIncidentNote(event.target.value)}
                rows={2}
                maxLength={2000}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection number={4} title={t("section.note")}>
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              data-testid="evaluation-note"
            />
          </Field>
        </FormSection>
        <ProblemNotice error={action.error} />
      </FormColumns>
      <MobileActionBar summary={t("summary.scoredValue", { scored, total: criteria.length })}>
        {save("evaluation-save-mobile")}
      </MobileActionBar>
    </div>
  );
}
