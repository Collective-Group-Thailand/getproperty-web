"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconButton } from "@/ui/components/IconButton";
import { LazyDialog } from "@/ui/components/overlays";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";

import {
  draftFrom,
  draftProblems,
  structureFrom,
  type DraftProblem,
  type StructureDraft,
  type TariffStructure,
} from "./structure";

/**
 * The maker's step of the tariff workflow (D-021a, D-140; `POST /v1/admin/utility-tariffs/{id}/versions`):
 * the structure as the utility publishes it — tiers (each upper bound is the next lower bound), or one
 * flat price; Ft for its period; the monthly service charge; the utility's own minimum; VAT; the
 * ceiling per unit as published — with its effective date, the published source and its date. It starts
 * from the version in force so only what changed is retyped. A second person verifies before publishing.
 */
export function EnterVersion({
  tariffId,
  name,
  unit,
  current,
}: {
  tariffId: string;
  name: string;
  unit: "kwh" | "m3";
  current: Partial<TariffStructure> | null;
}) {
  const t = useTranslations("admin.tariffs.editor");
  const common = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StructureDraft>(() => draftFrom(current));
  const [meta, setMeta] = useState({ effectiveFrom: "", sourceUrl: "", sourcePublishedOn: "", notes: "" });
  const [shown, setShown] = useState(false);
  const idempotency = useIdempotencyKey();
  const action = useApiAction({ refresh: false });
  const problems = draftProblems(draft);
  const ready =
    problems.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(meta.effectiveFrom) && /^https?:\/\//.test(meta.sourceUrl);
  const problemOf = (match: (problem: DraftProblem) => boolean) => (shown ? problems.find(match) : undefined);
  const set = (patch: Partial<StructureDraft>) => setDraft({ ...draft, ...patch });
  const tierError = (index: number, column: "to" | "price") => {
    const problem = problemOf(
      (p) => p.field === "tiers" && p.index === index && (p.problem === "price") === (column === "price"),
    );
    return problem && problem.field === "tiers" ? t(`problem.tier.${problem.problem}`) : undefined;
  };
  const fieldError = (field: Exclude<DraftProblem["field"], "tiers">) => {
    const problem = problemOf((p) => p.field === field);
    return problem && problem.field !== "tiers" ? t(`problem.${problem.problem}`) : undefined;
  };

  return (
    <>
      <Button
        iconStart={IconAdd}
        onClick={() => {
          action.reset();
          idempotency.renew();
          setDraft(draftFrom(current));
          setShown(false);
          setOpen(true);
        }}
        data-testid="enter-version"
      >
        {t("open")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={(next) => !action.busy && setOpen(next)}
        title={t("title", { name })}
        description={t("description")}
        size="lg"
        closeLabel={common("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={action.busy}>
              {common("cancel")}
            </Button>
            <Button type="submit" form={formId} loading={action.busy} data-testid="enter-version-submit">
              {t("submit")}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setShown(true);
            if (!ready) return;
            void action.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/admin/utility-tariffs/{tariffId}/versions", {
                    params: { path: { tariffId }, header: { "Idempotency-Key": idempotency.key } },
                    body: {
                      effectiveFrom: meta.effectiveFrom,
                      sourceUrl: meta.sourceUrl.trim(),
                      sourcePublishedOn: meta.sourcePublishedOn || null,
                      notes: meta.notes.trim() || null,
                      structure: structureFrom(draft, unit) as unknown as Record<string, never>,
                    },
                  }),
                ),
              () => {
                setOpen(false);
                toast.success(t("entered"));
                router.refresh();
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t("effectiveFrom")}
              required
              error={shown && !meta.effectiveFrom ? t("problem.required") : undefined}
            >
              <Input
                type="date"
                value={meta.effectiveFrom}
                onChange={(event) => setMeta({ ...meta, effectiveFrom: event.target.value })}
                data-testid="tariff-effective-from"
              />
            </Field>
            <Field
              label={t("sourceUrl")}
              hint={t("sourceUrlHint")}
              required
              className="sm:col-span-2"
              error={shown && !/^https?:\/\//.test(meta.sourceUrl) ? t("problem.url") : undefined}
            >
              <Input
                type="url"
                value={meta.sourceUrl}
                onChange={(event) => setMeta({ ...meta, sourceUrl: event.target.value })}
                data-testid="tariff-source-url"
              />
            </Field>
            <Field label={t("sourcePublishedOn")}>
              <Input
                type="date"
                value={meta.sourcePublishedOn}
                onChange={(event) => setMeta({ ...meta, sourcePublishedOn: event.target.value })}
              />
            </Field>
          </div>

          <FormSection title={t("rates")} description={t("ratesHint", { unit: t(`unit.${unit}`) })}>
            <SegmentedControl
              label={t("kind")}
              value={draft.kind}
              onValueChange={(kind) => set({ kind: kind as StructureDraft["kind"] })}
              options={[
                { value: "tiered", label: t("tiered") },
                { value: "flat", label: t("flat") },
              ]}
            />
            {draft.kind === "tiered" ? (
              <ol className="flex flex-col gap-2" aria-label={t("tiers")} data-testid="tier-list">
                {draft.tiers.map((tier, index) => {
                  const last = index === draft.tiers.length - 1;
                  const from = index === 0 ? "0" : draft.tiers[index - 1]!.toUnits || "…";
                  return (
                    <li
                      key={index}
                      className="grid items-end gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]"
                      data-testid="tier-row"
                    >
                      <span className="text-muted pb-2 text-sm">{t("tierFrom", { from })}</span>
                      <Field label={t("tierTo")} hint={last ? t("tierOpen") : undefined} error={tierError(index, "to")}>
                        <Input
                          inputMode="decimal"
                          value={tier.toUnits}
                          disabled={last}
                          onChange={(event) =>
                            set({
                              tiers: draft.tiers.map((x, i) =>
                                i === index ? { ...x, toUnits: event.target.value } : x,
                              ),
                            })
                          }
                          data-testid={`tier-to-${index}`}
                        />
                      </Field>
                      <Field label={t("tierPrice")} error={tierError(index, "price")}>
                        <Input
                          inputMode="decimal"
                          value={tier.pricePerUnit}
                          onChange={(event) =>
                            set({
                              tiers: draft.tiers.map((x, i) =>
                                i === index ? { ...x, pricePerUnit: event.target.value } : x,
                              ),
                            })
                          }
                          data-testid={`tier-price-${index}`}
                        />
                      </Field>
                      <IconButton
                        icon={IconDelete}
                        label={t("removeTier", { number: index + 1 })}
                        variant="ghost"
                        disabled={draft.tiers.length === 1}
                        onClick={() => {
                          const tiers = draft.tiers.filter((_, i) => i !== index);
                          // The last tier is always open-ended.
                          set({ tiers: tiers.map((x, i) => (i === tiers.length - 1 ? { ...x, toUnits: "" } : x)) });
                        }}
                      />
                    </li>
                  );
                })}
                <li>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart={IconAdd}
                    onClick={() =>
                      set({
                        tiers: [
                          ...draft.tiers.slice(0, -1),
                          { ...draft.tiers.at(-1)!, toUnits: "" },
                          { toUnits: "", pricePerUnit: "" },
                        ],
                      })
                    }
                    data-testid="add-tier"
                  >
                    {t("addTier")}
                  </Button>
                </li>
              </ol>
            ) : (
              <Field label={t("flatPrice")} required error={fieldError("flat")}>
                <Input
                  inputMode="decimal"
                  value={draft.flatPricePerUnit}
                  onChange={(event) => set({ flatPricePerUnit: event.target.value })}
                  data-testid="flat-price"
                />
              </Field>
            )}
          </FormSection>

          <FormSection title={t("charges")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("ft")} hint={t("ftHint")} error={fieldError("ft")}>
                <Input
                  inputMode="decimal"
                  value={draft.ftPricePerUnit}
                  onChange={(event) => set({ ftPricePerUnit: event.target.value })}
                  data-testid="ft-price"
                />
              </Field>
              <Field label={t("ftPeriod")} hint={t("ftPeriodHint")} error={fieldError("ftPeriod")}>
                <Input
                  value={draft.ftPeriod}
                  placeholder={t("ftPeriodPlaceholder")}
                  onChange={(event) => set({ ftPeriod: event.target.value })}
                  data-testid="ft-period"
                />
              </Field>
              <Field label={t("serviceCharge")} hint={t("serviceChargeHint")} error={fieldError("serviceCharge")}>
                <Input
                  inputMode="decimal"
                  value={draft.serviceCharge}
                  onChange={(event) => set({ serviceCharge: event.target.value })}
                />
              </Field>
              <Field label={t("minimumCharge")} hint={t("minimumChargeHint")} error={fieldError("minimumCharge")}>
                <Input
                  inputMode="decimal"
                  value={draft.minimumCharge}
                  onChange={(event) => set({ minimumCharge: event.target.value })}
                />
              </Field>
              <Field label={t("vatRate")} error={fieldError("vat")}>
                <Input
                  inputMode="decimal"
                  value={draft.vatRate}
                  onChange={(event) => set({ vatRate: event.target.value })}
                />
              </Field>
              <div className="flex items-end pb-1">
                <Checkbox
                  label={t("vatIncluded")}
                  checked={draft.vatIncluded}
                  onCheckedChange={(checked) => set({ vatIncluded: checked === true })}
                />
              </div>
            </div>
            <Field label={t("ceiling")} hint={t("ceilingHint")} required error={fieldError("ceiling")}>
              <Input
                inputMode="decimal"
                value={draft.ceilingPerUnit}
                onChange={(event) => set({ ceilingPerUnit: event.target.value })}
                data-testid="tariff-ceiling"
              />
            </Field>
            <Field label={t("needsCheck")} hint={t("needsCheckHint")}>
              <Input value={draft.needsCheck} onChange={(event) => set({ needsCheck: event.target.value })} />
            </Field>
          </FormSection>

          <Field label={t("notes")}>
            <Textarea
              rows={2}
              value={meta.notes}
              onChange={(event) => setMeta({ ...meta, notes: event.target.value })}
            />
          </Field>
          {shown && !ready ? (
            <div role="alert" data-testid="editor-problems">
              <Callout tone="danger">{t("fixFirst")}</Callout>
            </div>
          ) : null}
          <ProblemNotice error={action.error} />
        </form>
      </LazyDialog>
    </>
  );
}
