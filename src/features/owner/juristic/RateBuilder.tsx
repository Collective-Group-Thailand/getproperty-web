"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { BasisPreview } from "@/ui/components/BasisPreview";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconTag } from "@/ui/icons/glyphs/tag";

import { ownerPath } from "../shared/links";
import { previewDisplay, SPLIT_BY, suggestedSplit } from "./ratePreview";

const FREQUENCIES: Schemas["BillingFrequency"][] = ["monthly", "quarterly", "semiannual", "annual"];

/**
 * "สร้างอัตราจากงบนี้" (J-DESIGN §4 basis preview, J1.1b): choose what to bill (common fee or fund), how to share it
 * (ownership ratio, floor area, land, equal) and how often; the API previews what one unit pays a cycle — smallest,
 * median, largest — and whether the units add up to the budget ("รวม = งบ ✓"). Creating the draft sends the same
 * choice; the version starts on a future date and stays editable until then.
 */
export function RateBuilder({
  budget,
  propertyKind,
  unitsWord,
  blocked,
}: {
  budget: Schemas["BudgetDto"];
  propertyKind: Schemas["PropertyKind"] | null;
  /** "ห้อง" / "หลัง" — the property kind's plural word. */
  unitsWord: string;
  /** Why no draft may be created here: the budget is not approved yet, or the member may only read. */
  blocked?: "approve" | "permission";
}) {
  const t = useTranslations("owner.juristic.rate");
  const locale = useLocale() as Locale;
  const hasFund = budget.lines.some((line) => line.kind === "fund");
  const [kind, setKind] = useState<Schemas["JuristicChargeKind"]>("common_fee");
  const [splitBy, setSplitBy] = useState<Schemas["BudgetSplitBy"]>(suggestedSplit(propertyKind));
  const [frequency, setFrequency] = useState<Schemas["BillingFrequency"] | "">("");
  const [effectiveFrom, setEffectiveFrom] = useState(budget.periodStart);
  const [preview, setPreview] = useState<Schemas["RatePreviewDto"] | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  // The choice the shown preview answers: while it differs from the current one, a newer preview is on its way.
  const choice = JSON.stringify([kind, splitBy, frequency]);
  const [answered, setAnswered] = useState<string | null>(null);
  const loading = answered !== choice;
  const [draft, setDraft] = useState<Schemas["RateDraftDto"] | null>(null);
  const action = useApiAction<Schemas["RateDraftDto"]>({ refresh: false });
  const idempotency = useIdempotencyKey();
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    const asked = JSON.stringify([kind, splitBy, frequency]);
    const timer = window.setTimeout(() => {
      unwrap(
        browserApi().POST("/v1/owner/juristic/budgets/{budgetId}/rate-preview", {
          params: { path: { budgetId: budget.id } },
          body: { kind, splitBy, ...(frequency ? { frequency } : {}) },
        }),
      )
        .then((answer) => {
          if (id !== request.current) return;
          setPreview(answer);
          setPreviewError(null);
        })
        .catch((error: unknown) => {
          if (id === request.current) setPreviewError(error);
        })
        .finally(() => {
          if (id === request.current) setAnswered(asked);
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [budget.id, kind, splitBy, frequency]);

  const display = preview ? previewDisplay(preview, 1) : null;
  const cycleWord = preview ? t(`per.${preview.frequency}`) : "";
  const money = (value: string) => formatTHB(value, locale);

  const create = () => {
    // A changed choice is a new request; the same one retried keeps its key (contract §3).
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/budgets/{budgetId}/actions/create-rate-plan-draft", {
            params: { path: { budgetId: budget.id }, header: { "Idempotency-Key": idempotency.key } },
            body: { kind, splitBy, effectiveFrom, ...(frequency ? { frequency } : {}) },
          }),
        ),
      (answer) => {
        setDraft(answer);
        idempotency.renew();
      },
    );
  };

  return (
    <div className="flex flex-col gap-5" data-testid="rate-builder">
      <div className="grid gap-4 md:grid-cols-2">
        {hasFund ? (
          <Field label={t("kind")}>
            <SegmentedControl
              label={t("kind")}
              value={kind}
              onValueChange={(value) => setKind(value as Schemas["JuristicChargeKind"])}
              options={(["common_fee", "fund"] as const).map((value) => ({ value, label: t(`kindName.${value}`) }))}
            />
          </Field>
        ) : null}
        <Field label={t("frequency")} hint={t("frequencyHint")}>
          <NativeSelect
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as Schemas["BillingFrequency"] | "")}
            options={[
              { value: "", label: t("frequencyDefault") },
              ...FREQUENCIES.map((value) => ({ value, label: t(`frequencyName.${value}`) })),
            ]}
            data-testid="rate-frequency"
          />
        </Field>
      </div>
      <Field label={t("splitBy")}>
        <RadioCards
          columns={2}
          value={splitBy}
          onValueChange={(value) => setSplitBy(value as Schemas["BudgetSplitBy"])}
          options={SPLIT_BY.map((value) => ({
            value,
            label: t(`split.${value}`),
            description: t(`splitHint.${value}`),
          }))}
        />
      </Field>

      <section
        aria-labelledby="preview-title"
        className="rounded-card border-border bg-bg-subtle flex flex-col gap-4 border p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="preview-title" className="m-0 text-base font-semibold">
            {t("previewTitle")}
          </h3>
          {preview ? (
            <p className="text-muted m-0 text-sm" data-testid="rate-amounts">
              {t("previewAmounts", {
                annual: money(preview.annualAmount),
                cycle: money(preview.cycleAmount),
                per: cycleWord,
              })}
            </p>
          ) : null}
        </div>
        {previewError && !preview ? (
          <ProblemNotice error={previewError} />
        ) : display && preview ? (
          <BasisPreview
            caption={t("previewCaption", { per: cycleWord })}
            amountHeader={t("amountHeader", { per: cycleWord })}
            busy={loading}
            rows={display.rows.map((row) => ({
              key: row.key,
              label: t(`row.${row.key}`),
              amount: money(row.amount),
              detail:
                row.key === "min" && display.lowest[0]
                  ? t("rowUnit", { unit: display.lowest[0].unitNo, weight: display.lowest[0].weight })
                  : row.key === "max" && display.highest[0]
                    ? t("rowUnit", { unit: display.highest[0].unitNo, weight: display.highest[0].weight })
                    : undefined,
            }))}
            check={
              display.check.state === "match"
                ? {
                    ok: true,
                    label: t("check.match"),
                    detail: t("check.matchDetail", {
                      sum: money(display.check.sum),
                      per: cycleWord,
                      count: formatNumber(display.unitsCount, locale),
                      units: unitsWord,
                    }),
                  }
                : display.check.state === "missing"
                  ? {
                      ok: false,
                      label: t("check.missing", { count: display.check.missing, units: unitsWord }),
                      detail: t("check.missingDetail", { weight: t(`split.${splitBy}`) }),
                    }
                  : {
                      ok: false,
                      label: t("check.mismatch"),
                      detail: t("check.mismatchDetail", {
                        sum: money(display.check.sum),
                        cycle: money(display.check.cycleAmount),
                      }),
                    }
            }
          />
        ) : (
          <p className="text-muted m-0 text-sm" aria-live="polite">
            {t("previewLoading")}
          </p>
        )}
      </section>

      {draft ? (
        <Callout
          tone="success"
          title={t("drafted", { plan: draft.plan.name })}
          action={
            <Button asChild size="sm" variant="secondary" iconStart={IconTag}>
              <a href={ownerPath(locale, "/billing/rate-plans")} data-testid="rate-open-plans">
                {t("openPlans")}
              </a>
            </Button>
          }
        >
          {t("draftedBody", { date: formatDate(effectiveFrom, locale) })}
        </Callout>
      ) : !blocked ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")}>
            <div className="max-w-64" data-testid="rate-effective-from">
              <DateField
                name="effectiveFrom"
                defaultValue={effectiveFrom}
                onChange={(value) => setEffectiveFrom(value ?? "")}
              />
            </div>
          </Field>
          <Button
            onClick={create}
            loading={action.busy}
            disabled={!display?.canDraft || loading}
            data-testid="rate-create-draft"
          >
            {t("createDraft")}
          </Button>
        </div>
      ) : (
        <Callout tone="info" title={t(blocked === "approve" ? "approveFirstTitle" : "readOnlyTitle")}>
          {t(blocked === "approve" ? "approveFirst" : "readOnly")}
        </Callout>
      )}
      <ProblemNotice error={action.error} />
    </div>
  );
}
