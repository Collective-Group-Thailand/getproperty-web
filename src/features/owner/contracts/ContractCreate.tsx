"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokToday } from "@/features/shared/console/time";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconRemove } from "@/ui/icons/glyphs/remove";

import { ownerPath } from "../shared/links";
import { LANGUAGES } from "./labels";

type Kind = Schemas["SignableContractKind"];
type Option = { id: string; label: string };

export interface ContractCreateOptions {
  units: Option[];
  parties: Option[];
  leases: Option[];
  mandates: Option[];
  agreements: Option[];
  /** Published versions of the signable kinds: my templates and the platform drafts. */
  templates: (Option & { kind: Kind; language: Schemas["Language"]; own: boolean })[];
}

const MAX_CLAUSES = 5;
const money = (value: string | undefined) => value?.replace(/,/g, "");

/**
 * New signable contract (G3, D-294). The kind decides what it is written on — a unit and the person reserving, a
 * lease, a mandate or a co-broke agreement — and the few values the user types (fee, dates, added clauses, a note);
 * the template version is mine or the platform draft in the chosen language. The API fills every other variable and
 * refuses unknown ones (`contract.unknown_variable`).
 */
export function ContractCreate({
  options,
  defaults,
}: {
  options: ContractCreateOptions;
  defaults: { open: boolean; kind?: Kind; leaseId?: string; mandateId?: string; agreementId?: string };
}) {
  const t = useTranslations("owner.contracts.create");
  const c = useTranslations("owner.contracts");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const offered: Kind[] = [
    ...(options.units.length && options.parties.length ? (["reservation"] as const) : []),
    ...(options.leases.length ? (["addendum"] as const) : []),
    ...(options.mandates.length ? (["brokerage_mandate"] as const) : []),
    ...(options.agreements.length ? (["co_broke"] as const) : []),
  ];
  const [kind, setKind] = useState<Kind | undefined>(
    defaults.kind && offered.includes(defaults.kind) ? defaults.kind : offered[0],
  );
  const [language, setLanguage] = useState<Schemas["Language"]>(locale === "en" ? "en" : "th");
  const [clauses, setClauses] = useState([{ title: "", text: "" }]);
  if (!kind) return null;
  const templates = options.templates.filter((template) => template.kind === kind && template.language === language);

  const variables = (data: FormData): Schemas["ContractVariablesDto"] => {
    switch (kind) {
      case "reservation":
        return {
          fee: money(text(data, "fee")),
          rent: money(text(data, "rent")),
          moveInDate: text(data, "moveInDate"),
          expiresOn: text(data, "expiresOn"),
          refundTerms: text(data, "refundTerms"),
        };
      case "addendum":
        return {
          effectiveDate: text(data, "effectiveDate"),
          clauses: clauses
            .map((clause) => ({ title: clause.title.trim(), text: clause.text.trim() }))
            .filter((clause) => clause.title || clause.text),
        };
      default:
        return { note: text(data, "note") };
    }
  };

  return (
    <FormDialog
      label={t("label")}
      icon={IconAdd}
      variant="primary"
      size_="lg"
      testId="contract-new"
      defaultOpen={defaults.open}
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={(data) => {
        const values = Object.fromEntries(
          Object.entries(variables(data)).filter(([, value]) => value !== undefined),
        ) as Schemas["ContractVariablesDto"];
        return unwrap(
          browserApi().POST("/v1/owner/contracts", {
            body: {
              kind,
              language,
              title: text(data, "title"),
              templateVersionId: text(data, "templateVersionId"),
              unitId: kind === "reservation" ? text(data, "unitId") : undefined,
              partyId: kind === "reservation" ? text(data, "partyId") : undefined,
              leaseId: kind === "addendum" ? text(data, "leaseId") : undefined,
              mandateId: kind === "brokerage_mandate" ? text(data, "mandateId") : undefined,
              coBrokeAgreementId: kind === "co_broke" ? text(data, "coBrokeAgreementId") : undefined,
              variables: values,
            },
          }),
        );
      }}
      onDone={(result) =>
        router.push(ownerPath(locale, `/contracts/documents/${(result as Schemas["ContractDto"]).id}`))
      }
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("kind")} required error={errors.kind}>
            <NativeSelect
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as Kind)}
              options={offered.map((value) => ({ value, label: c(`kind.${value}`) }))}
              data-testid="contract-kind"
            />
          </Field>
          <Field label={t("language")} required error={errors.language}>
            <NativeSelect
              name="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Schemas["Language"])}
              options={LANGUAGES.map((value) => ({ value, label: c(`language.${value}`) }))}
              data-testid="contract-language"
            />
          </Field>
          <Field
            label={t("template")}
            hint={t("templateHint")}
            error={errors.templateVersionId}
            className="sm:col-span-2"
          >
            <NativeSelect
              name="templateVersionId"
              key={`${kind}-${language}`}
              placeholder={t("templateDefault")}
              options={templates
                .filter((template) => template.own)
                .map((template) => ({ value: template.id, label: template.label }))}
              data-testid="contract-template"
            />
          </Field>
          <Field label={t("titleField")} hint={t("titleHint")} error={errors.title} className="sm:col-span-2">
            <Input name="title" maxLength={200} />
          </Field>

          {kind === "reservation" ? (
            <>
              <Field label={t("unit")} required error={errors.unitId}>
                <NativeSelect
                  name="unitId"
                  options={options.units.map((o) => ({ value: o.id, label: o.label }))}
                  data-testid="contract-unit"
                />
              </Field>
              <Field label={t("party")} required error={errors.partyId}>
                <NativeSelect
                  name="partyId"
                  options={options.parties.map((o) => ({ value: o.id, label: o.label }))}
                  data-testid="contract-party"
                />
              </Field>
              <Field label={t("fee")} required hint={t("moneyHint")} error={errors["variables.fee"]}>
                <Input name="fee" inputMode="decimal" className="tabular-nums" data-testid="contract-fee" />
              </Field>
              <Field label={t("rent")} hint={t("rentHint")} error={errors["variables.rent"]}>
                <Input name="rent" inputMode="decimal" className="tabular-nums" />
              </Field>
              <Field label={t("moveInDate")} error={errors["variables.moveInDate"]}>
                <Input name="moveInDate" type="date" min={bangkokToday()} />
              </Field>
              <Field label={t("expiresOn")} error={errors["variables.expiresOn"]}>
                <Input name="expiresOn" type="date" min={bangkokToday()} />
              </Field>
              <Field
                label={t("refundTerms")}
                hint={t("refundHint")}
                error={errors["variables.refundTerms"]}
                className="sm:col-span-2"
              >
                <Textarea name="refundTerms" rows={2} />
              </Field>
            </>
          ) : null}

          {kind === "addendum" ? (
            <>
              <Field label={t("lease")} required error={errors.leaseId}>
                <NativeSelect
                  name="leaseId"
                  defaultValue={defaults.leaseId}
                  options={options.leases.map((o) => ({ value: o.id, label: o.label }))}
                  data-testid="contract-lease"
                />
              </Field>
              <Field label={t("effectiveDate")} hint={t("effectiveHint")} error={errors["variables.effectiveDate"]}>
                <Input name="effectiveDate" type="date" defaultValue={bangkokToday()} />
              </Field>
              <fieldset className="flex flex-col gap-3 sm:col-span-2" data-testid="contract-clauses">
                <legend className="mb-1 font-medium">{t("clauses")}</legend>
                {clauses.map((clause, index) => (
                  <div key={index} className="border-border rounded-card flex flex-col gap-2 border p-3">
                    <Field
                      label={t("clauseTitle", { n: index + 1 })}
                      error={errors[`variables.clauses.${index}.title`]}
                    >
                      <Input
                        value={clause.title}
                        maxLength={200}
                        onChange={(event) =>
                          setClauses((all) =>
                            all.map((c2, i) => (i === index ? { ...c2, title: event.target.value } : c2)),
                          )
                        }
                        data-testid="clause-title"
                      />
                    </Field>
                    <Field label={t("clauseText", { n: index + 1 })} error={errors[`variables.clauses.${index}.text`]}>
                      <Textarea
                        rows={2}
                        maxLength={2000}
                        value={clause.text}
                        onChange={(event) =>
                          setClauses((all) =>
                            all.map((c2, i) => (i === index ? { ...c2, text: event.target.value } : c2)),
                          )
                        }
                        data-testid="clause-text"
                      />
                    </Field>
                    {clauses.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconStart={IconRemove}
                        className="self-start"
                        onClick={() => setClauses((all) => all.filter((_, i) => i !== index))}
                      >
                        {t("removeClause")}
                      </Button>
                    ) : null}
                  </div>
                ))}
                {clauses.length < MAX_CLAUSES ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    iconStart={IconAdd}
                    className="self-start"
                    onClick={() => setClauses((all) => [...all, { title: "", text: "" }])}
                  >
                    {t("addClause")}
                  </Button>
                ) : null}
                {errors["variables.clauses"] ? <Callout tone="danger">{errors["variables.clauses"]}</Callout> : null}
              </fieldset>
            </>
          ) : null}

          {kind === "brokerage_mandate" ? (
            <Field label={t("mandate")} required error={errors.mandateId} className="sm:col-span-2">
              <NativeSelect
                name="mandateId"
                defaultValue={defaults.mandateId}
                options={options.mandates.map((o) => ({ value: o.id, label: o.label }))}
                data-testid="contract-mandate"
              />
            </Field>
          ) : null}
          {kind === "co_broke" ? (
            <Field label={t("agreement")} required error={errors.coBrokeAgreementId} className="sm:col-span-2">
              <NativeSelect
                name="coBrokeAgreementId"
                defaultValue={defaults.agreementId}
                options={options.agreements.map((o) => ({ value: o.id, label: o.label }))}
                data-testid="contract-agreement"
              />
            </Field>
          ) : null}
          {kind === "brokerage_mandate" || kind === "co_broke" ? (
            <Field label={t("note")} hint={t("noteHint")} error={errors["variables.note"]} className="sm:col-span-2">
              <Textarea name="note" rows={3} />
            </Field>
          ) : null}
        </div>
      )}
    </FormDialog>
  );
}
