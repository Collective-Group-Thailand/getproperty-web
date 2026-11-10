"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError, toFieldName } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Combobox } from "@/ui/components/Combobox";
import { ErrorSummary } from "@/ui/components/ErrorSummary";
import { Field } from "@/ui/components/Field";
import { FormColumns, FormSection, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { ownerPath } from "../../shared/links";
import { cleanTaxId, taxIdProblem } from "./taxId";

const CATEGORIES: readonly Schemas["VendorCategory"][] = [
  "security",
  "cleaning",
  "gardening",
  "lift",
  "pump",
  "fire_system",
  "electrical",
  "plumbing",
  "pest_control",
  "pool",
  "cctv",
  "waste",
  "building_works",
  "professional",
  "insurance",
  "other",
];

export interface PartyOption {
  id: string;
  name: string;
  company: boolean;
  taxId: boolean;
}

/**
 * A vendor as a numbered form (D-331): 1 who — a company or person of the register, or a new one (name, type, the
 * 13-digit tax id checked digit by digit), 2 the kinds of work, 3 the contact person, 4 the bank account by its **last
 * four digits only** (the office records payments, it never makes them), 5 a note. The API keeps the tax id on the
 * party, where the 50 ทวิ reads it.
 */
export function VendorForm({ vendor, parties }: { vendor?: Schemas["VendorDto"]; parties: PartyOption[] }) {
  const t = useTranslations("owner.vendors.form");
  const categoryWords = useTranslations("owner.vendors.category");
  const locale = useLocale() as Locale;
  const [source, setSource] = useState<"new" | "party">("new");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [name, setName] = useState(vendor?.name ?? "");
  const [type, setType] = useState<Schemas["PartyType"]>(vendor?.partyType ?? "company");
  const [taxId, setTaxId] = useState("");
  const [categories, setCategories] = useState<Schemas["VendorCategory"][]>(vendor?.categories ?? []);
  const [contactName, setContactName] = useState(vendor?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(vendor?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(vendor?.contactEmail ?? "");
  const [bankName, setBankName] = useState(vendor?.bankName ?? "");
  const [bankAccountName, setBankAccountName] = useState(vendor?.bankAccountName ?? "");
  const [last4, setLast4] = useState(vendor?.bankAccountLast4 ?? "");
  const [note, setNote] = useState(vendor?.note ?? "");
  const [attempt, setAttempt] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const action = useApiAction<Schemas["VendorDto"]>({ refresh: false });

  const apiErrors: Record<string, string> = isApiError(action.error)
    ? Object.fromEntries(action.error.errors.map((error) => [`vendor-${toFieldName(error.path)}`, error.message]))
    : {};
  const errors = { ...apiErrors, ...local };
  const fromParty = !vendor && source === "party";
  const party = parties.find((candidate) => candidate.id === partyId) ?? null;

  const validate = () => {
    const found: Record<string, string> = {};
    if (fromParty && !partyId) found["vendor-partyId"] = t("error.party");
    if (!fromParty && !name.trim()) found["vendor-name"] = t("error.name");
    const taxProblem = taxIdProblem(taxId);
    if (taxProblem) found["vendor-taxId"] = t(`error.taxId.${taxProblem}`);
    if (last4 && !/^\d{4}$/.test(last4)) found["vendor-bankAccountLast4"] = t("error.last4");
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
      found["vendor-contactEmail"] = t("error.email");
    return found;
  };

  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  const nullable = (value: string) => (value.trim() ? value.trim() : null);

  const submit = () => {
    const found = validate();
    setLocal(found);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length) return;
    void action.run(
      async () =>
        vendor
          ? unwrap(
              browserApi().PATCH("/v1/owner/juristic/vendors/{vendorId}", {
                params: { path: { vendorId: vendor.id } },
                body: {
                  name: name.trim(),
                  ...(taxId.trim() ? { taxId: cleanTaxId(taxId) } : {}),
                  categories,
                  contactName: nullable(contactName),
                  contactPhone: nullable(contactPhone),
                  contactEmail: nullable(contactEmail),
                  bankName: nullable(bankName),
                  bankAccountName: nullable(bankAccountName),
                  bankAccountLast4: nullable(last4),
                  note: nullable(note),
                  version: vendor.version,
                },
              }),
            )
          : unwrap(
              browserApi().POST("/v1/owner/juristic/vendors", {
                body: {
                  ...(fromParty && partyId ? { partyId, name: party?.name ?? "" } : { name: name.trim(), type }),
                  ...(taxId.trim() ? { taxId: cleanTaxId(taxId) } : {}),
                  categories,
                  contactName: optional(contactName),
                  contactPhone: optional(contactPhone),
                  contactEmail: optional(contactEmail),
                  bankName: optional(bankName),
                  bankAccountName: optional(bankAccountName),
                  bankAccountLast4: optional(last4),
                  note: optional(note),
                },
              }),
            ),
      (saved) => window.location.assign(ownerPath(locale, `/juristic/vendors/${saved.id}`)),
    );
  };

  const save = (testId: string) => (
    <Button onClick={submit} loading={action.busy} data-testid={testId}>
      {vendor ? t("saveEdit") : t("save")}
    </Button>
  );
  const toggle = (category: Schemas["VendorCategory"], on: boolean) =>
    setCategories((all) => (on ? [...all, category] : all.filter((entry) => entry !== category)));

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: Object.keys(errors).length })}
        items={Object.entries(errors).map(([key, message]) => ({ fieldId: key, message }))}
        focusKey={attempt}
        testId="vendor-errors"
      />
      <FormColumns
        summary={
          <FormSummary
            title={t("summary.title")}
            rows={[
              {
                key: "who",
                label: t("summary.who"),
                value: (fromParty ? party?.name : name.trim()) || t("summary.none"),
              },
              {
                key: "categories",
                label: t("summary.categories"),
                value: categories.length
                  ? categories.map((entry) => categoryWords(entry)).join(" · ")
                  : t("summary.none"),
              },
              {
                key: "bank",
                label: t("summary.bank"),
                value: last4 ? `····${last4}` : t("summary.none"),
              },
            ]}
            action={save("vendor-save")}
            note={t("summary.note")}
          />
        }
      >
        <FormSection number={1} title={t("section.who")} description={t("section.whoHint")}>
          {vendor ? null : (
            <SegmentedControl
              label={t("section.who")}
              value={source}
              onValueChange={(value) => setSource(value as "new" | "party")}
              options={[
                { value: "new", label: t("sourceNew") },
                { value: "party", label: t("sourceParty") },
              ]}
            />
          )}
          {fromParty ? (
            <Field label={t("party")} hint={t("partyHint")} required error={errors["vendor-partyId"]}>
              <Combobox
                options={parties.map((option) => ({
                  value: option.id,
                  label: option.name,
                  description: option.company ? t("company") : t("person"),
                }))}
                value={partyId}
                onChange={setPartyId}
                placeholder={t("partyPlaceholder")}
                emptyLabel={t("noParty")}
                listLabel={t("party")}
              />
            </Field>
          ) : (
            <>
              <Field label={t("name")} hint={t("nameHint")} required error={errors["vendor-name"]}>
                <Input
                  id="vendor-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  data-testid="vendor-name"
                />
              </Field>
              {vendor ? null : (
                <Field label={t("type")}>
                  <SegmentedControl
                    label={t("type")}
                    value={type}
                    onValueChange={(value) => setType(value as Schemas["PartyType"])}
                    options={[
                      { value: "company", label: t("company") },
                      { value: "person", label: t("person") },
                    ]}
                  />
                </Field>
              )}
            </>
          )}
          <Field
            label={t("taxId")}
            hint={vendor?.taxIdHint ? t("taxIdKept", { last: vendor.taxIdHint }) : t("taxIdHint")}
            error={errors["vendor-taxId"]}
          >
            <Input
              id="vendor-taxId"
              value={taxId}
              onChange={(event) => setTaxId(event.target.value)}
              onBlur={() => {
                const problem = taxIdProblem(taxId);
                setLocal((all) => {
                  const next = { ...all };
                  if (problem) next["vendor-taxId"] = t(`error.taxId.${problem}`);
                  else delete next["vendor-taxId"];
                  return next;
                });
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              className="tabular-nums sm:max-w-xs"
              data-testid="vendor-tax-id"
            />
          </Field>
        </FormSection>

        <FormSection number={2} title={t("section.work")} description={t("section.workHint")}>
          <fieldset
            className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="vendor-categories"
          >
            <legend className="sr-only">{t("section.work")}</legend>
            {CATEGORIES.map((category) => (
              <Checkbox
                key={category}
                checked={categories.includes(category)}
                onCheckedChange={(checked) => toggle(category, checked === true)}
                label={categoryWords(category)}
                data-testid={`vendor-category-${category}`}
              />
            ))}
          </fieldset>
        </FormSection>

        <FormSection number={3} title={t("section.contact")} description={t("section.contactHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("contactName")}>
              <Input value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={200} />
            </Field>
            <Field label={t("contactPhone")} error={errors["vendor-contactPhone"]}>
              <Input
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                inputMode="tel"
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label={t("contactEmail")} error={errors["vendor-contactEmail"]}>
            <Input
              id="vendor-contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </FormSection>

        <FormSection number={4} title={t("section.bank")} description={t("section.bankHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("bankName")}>
              <Input value={bankName} onChange={(event) => setBankName(event.target.value)} maxLength={100} />
            </Field>
            <Field label={t("bankAccountName")}>
              <Input
                value={bankAccountName}
                onChange={(event) => setBankAccountName(event.target.value)}
                maxLength={200}
              />
            </Field>
          </div>
          <Field label={t("last4")} hint={t("last4Hint")} error={errors["vendor-bankAccountLast4"]}>
            <Input
              id="vendor-bankAccountLast4"
              value={last4}
              onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              className="w-28 tabular-nums"
              data-testid="vendor-last4"
            />
          </Field>
        </FormSection>

        <FormSection number={5} title={t("section.note")}>
          <Field label={t("note")}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} />
          </Field>
        </FormSection>
        <ProblemNotice error={action.error} />
      </FormColumns>
      <MobileActionBar summary={(fromParty ? party?.name : name.trim()) || t("summary.none")}>
        {save("vendor-save-mobile")}
      </MobileActionBar>
    </div>
  );
}
