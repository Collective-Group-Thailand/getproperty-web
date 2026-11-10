"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError, toFieldName } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { ErrorSummary, type ErrorSummaryItem } from "@/ui/components/ErrorSummary";
import { Field } from "@/ui/components/Field";
import { FormColumns, FormSection, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";

import { ownerPath } from "../shared/links";

type Kind = Schemas["BudgetLineKind"];
interface Line {
  key: string;
  label: string;
  amount: string;
}

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const SECTIONS: Kind[] = ["expense", "fund", "income"];

/**
 * A new yearly budget (J1.1b, D-304) as a numbered form: the building and year, then the lines the owners pay for
 * (expenses), the contributions to the funds, and other income shown beside them. Amounts are typed as baht and sent
 * as they are; the totals are the API's, shown on the budget after saving — this form adds nothing up.
 */
export function BudgetForm({
  buildings,
  defaultBuildingId,
}: {
  buildings: { id: string; name: string }[];
  defaultBuildingId?: string;
}) {
  const t = useTranslations("owner.juristic.budget");
  const locale = useLocale() as Locale;
  const nextKey = useRef(10);
  const [buildingId, setBuildingId] = useState(defaultBuildingId ?? buildings[0]?.id ?? "");
  // The year is typed in the reader's era (พ.ศ. in Thai) and sent to the API in the Gregorian calendar.
  const era = locale === "th" ? 543 : 0;
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear + 1 + era));
  const [name, setName] = useState("");
  const [lines, setLines] = useState<Record<Kind, Line[]>>({
    expense: [{ key: "e1", label: "", amount: "" }],
    fund: [],
    income: [],
  });
  const [attempt, setAttempt] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const action = useApiAction<Schemas["BudgetDto"]>({ refresh: false });

  const apiErrors: Record<string, string> = isApiError(action.error)
    ? Object.fromEntries(action.error.errors.map((error) => [toFieldName(error.path), error.message]))
    : {};
  const errors = { ...apiErrors, ...local };
  const flat = SECTIONS.flatMap((kind) => lines[kind].map((line) => ({ kind, line })));
  const fieldId = (key: string, part: "label" | "amount") => `line-${key}-${part}`;

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!buildingId) found.buildingId = t("error.building");
    if (!/^\d{4}$/.test(year)) found.fiscalYear = t("error.year");
    if (!name.trim()) found.name = t("error.name");
    if (flat.length === 0) found.lines = t("error.noLines");
    for (const { line } of flat) {
      if (!line.label.trim()) found[fieldId(line.key, "label")] = t("error.label");
      if (!AMOUNT.test(line.amount.trim().replace(/,/g, ""))) found[fieldId(line.key, "amount")] = t("error.amount");
    }
    return found;
  };

  const summaryItems: ErrorSummaryItem[] = Object.entries(errors).map(([key, message]) => ({
    fieldId: key.startsWith("line-") ? key : key === "lines" ? "budget-lines" : `budget-${key}`,
    message,
  }));

  const submit = () => {
    const found = validate();
    setLocal(found);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length) return;
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/budgets", {
            body: {
              buildingId,
              fiscalYear: Number(year) - era,
              name: name.trim(),
              lines: flat.map(({ kind, line }) => ({
                kind,
                label: line.label.trim(),
                amount: line.amount.trim().replace(/,/g, ""),
              })),
            },
          }),
        ),
      (budget) => window.location.assign(ownerPath(locale, `/juristic/budgets/${budget.id}`)),
    );
  };

  const update = (kind: Kind, key: string, patch: Partial<Line>) =>
    setLines((all) => ({ ...all, [kind]: all[kind].map((line) => (line.key === key ? { ...line, ...patch } : line)) }));
  const add = (kind: Kind) => {
    nextKey.current += 1;
    const key = `${kind[0]}${nextKey.current}`;
    setLines((all) => ({ ...all, [kind]: [...all[kind], { key, label: "", amount: "" }] }));
  };
  const remove = (kind: Kind, key: string) =>
    setLines((all) => ({ ...all, [kind]: all[kind].filter((line) => line.key !== key) }));

  const save = (testId: string) => (
    <Button onClick={submit} loading={action.busy} data-testid={testId}>
      {t("save")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: summaryItems.length })}
        items={summaryItems}
        focusKey={attempt}
        testId="budget-errors"
      />
      <FormColumns
        summary={
          <FormSummary
            title={t("summary.title")}
            rows={SECTIONS.map((kind) => ({
              key: kind,
              label: t(`section.${kind}`),
              value: t("summary.lines", { count: lines[kind].length }),
            }))}
            action={save("budget-save")}
            note={t("summary.note")}
          />
        }
      >
        <FormSection number={1} title={t("section.about")} description={t("section.aboutHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required error={errors.buildingId}>
              <NativeSelect
                id="budget-buildingId"
                value={buildingId}
                onChange={(event) => setBuildingId(event.target.value)}
                options={buildings.map((building) => ({ value: building.id, label: building.name }))}
                data-testid="budget-building"
              />
            </Field>
            <Field label={t("fiscalYear")} hint={t("fiscalYearHint")} required error={errors.fiscalYear}>
              <Input
                id="budget-fiscalYear"
                value={year}
                onChange={(event) => setYear(event.target.value.trim())}
                inputMode="numeric"
                maxLength={4}
                className="max-w-32"
                data-testid="budget-year"
              />
            </Field>
          </div>
          <Field label={t("name")} hint={t("nameHint")} required error={errors.name}>
            <Input
              id="budget-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              data-testid="budget-name"
            />
          </Field>
        </FormSection>

        {SECTIONS.map((kind, position) => (
          <FormSection
            key={kind}
            number={position + 2}
            title={t(`section.${kind}`)}
            description={t(`section.${kind}Hint`)}
            testId={`budget-section-${kind}`}
          >
            <div id={kind === "expense" ? "budget-lines" : undefined} tabIndex={-1} className="flex flex-col gap-3">
              {lines[kind].length === 0 ? <p className="text-muted m-0 text-sm">{t("noLines")}</p> : null}
              {lines[kind].map((line, index) => (
                <div
                  key={line.key}
                  className="grid grid-cols-[minmax(0,1fr)_10rem_auto] items-end gap-3"
                  data-testid="budget-line"
                >
                  <Field label={t("lineLabel")} labelHidden={index > 0} error={errors[fieldId(line.key, "label")]}>
                    <Input
                      id={fieldId(line.key, "label")}
                      value={line.label}
                      onChange={(event) => update(kind, line.key, { label: event.target.value })}
                      maxLength={200}
                      data-testid="budget-line-label"
                    />
                  </Field>
                  <Field label={t("lineAmount")} labelHidden={index > 0} error={errors[fieldId(line.key, "amount")]}>
                    <Input
                      id={fieldId(line.key, "amount")}
                      value={line.amount}
                      onChange={(event) => update(kind, line.key, { amount: event.target.value })}
                      inputMode="decimal"
                      className="text-end tabular-nums"
                      data-testid="budget-line-amount"
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    iconStart={IconDelete}
                    onClick={() => remove(kind, line.key)}
                    aria-label={t("removeLine", { n: index + 1 })}
                  >
                    <span className="sr-only">{t("removeLine", { n: index + 1 })}</span>
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart={IconAdd}
                  onClick={() => add(kind)}
                  data-testid={`budget-add-${kind}`}
                >
                  {t("addLine")}
                </Button>
              </div>
            </div>
          </FormSection>
        ))}
        <ProblemNotice error={action.error} />
      </FormColumns>
      <MobileActionBar summary={t("summary.mobile", { count: flat.length })}>
        {save("budget-save-mobile")}
      </MobileActionBar>
    </div>
  );
}
