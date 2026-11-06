"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError, toFieldName } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Combobox } from "@/ui/components/Combobox";
import { ErrorSummary } from "@/ui/components/ErrorSummary";
import { Field } from "@/ui/components/Field";
import { FieldError } from "@/ui/components/FieldError";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { FormColumns, FormSection, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { StatusText } from "@/ui/components/StatusText";
import { Switch } from "@/ui/components/Switch";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconInfo } from "@/ui/icons/glyphs/info";

import { ownerPath } from "../../shared/links";
import { uploadOwnerFile } from "../../shared/upload";
import { decimalSatang, normaliseAmount, parseSatang } from "../accounting/money";
import { whtRateLabel, type WhtRate } from "../accounting/wht";
import { PRIORITIES, slaRows, slaTerms, type Priority, type SlaRowInput } from "./contracts";

const MAX_BYTES = 10 * 1024 * 1024;
const FREQUENCIES: readonly Schemas["InstalmentFrequency"][] = ["monthly", "quarterly", "semiannual", "annual", "once"];
const DOCUMENT_KINDS: readonly Schemas["ContractDocumentKind"][] = [
  "contract",
  "amendment",
  "insurance",
  "guarantee",
  "other",
];
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

interface Pending {
  key: string;
  file: File;
  kind: Schemas["ContractDocumentKind"];
}

/**
 * The contract editor (D-331) as numbered sections: 1 the parties and the term, 2 the scope, 3 SLA hours per priority,
 * 4 the instalment plan (in words — the schedule is made by the API when the contract is activated, never here), 5
 * penalty clauses, 6 where it comes from (the quotation round awarded to this vendor, an adopted resolution) and the
 * documents. It saves a draft; the record then activates it. The summary states the quotation rule from the setting.
 */
export function ContractForm({
  buildings,
  vendors,
  accounts,
  rates,
  rounds,
  resolutions,
  threshold,
  defaultBuildingId,
  defaultVendorId,
  contract,
}: {
  buildings: { id: string; name: string }[];
  vendors: { id: string; name: string; categories: Schemas["VendorCategory"][] }[];
  accounts: { id: string; label: string }[];
  rates: WhtRate[];
  rounds: { id: string; buildingId: string; vendorId: string; label: string }[];
  resolutions: { id: string; buildingId: string; label: string }[];
  threshold: string | null;
  defaultBuildingId?: string;
  defaultVendorId?: string;
  contract?: Schemas["VendorContractDetailDto"];
}) {
  const t = useTranslations("owner.vendors.editor");
  const categoryWords = useTranslations("owner.vendors.category");
  const planWords = useTranslations("owner.vendors.plan");
  const priorityWords = useTranslations("status.priority");
  const documentWords = useTranslations("owner.vendors.contract.documentKind");
  const common = useTranslations("owner.accounting.common");
  const locale = useLocale() as Locale;
  const counter = useRef(10);
  const [buildingId, setBuildingId] = useState(contract?.buildingId ?? defaultBuildingId ?? buildings[0]?.id ?? "");
  const [vendorId, setVendorId] = useState<string | null>(contract?.vendorId ?? defaultVendorId ?? null);
  const [title, setTitle] = useState(contract?.title ?? "");
  const [category, setCategory] = useState<string>(
    contract?.category ?? vendors.find((vendor) => vendor.id === defaultVendorId)?.categories[0] ?? "",
  );
  const [startsOn, setStartsOn] = useState<string | null>(contract?.startsOn ?? null);
  const [endsOn, setEndsOn] = useState<string | null>(contract?.endsOn ?? null);
  const [noticeDays, setNoticeDays] = useState(String(contract?.renewalNoticeDays ?? 60));
  const [value, setValue] = useState(contract?.value ?? "");
  const [scope, setScope] = useState(contract?.scope ?? "");
  const [sla, setSla] = useState<SlaRowInput[]>(slaRows(contract?.slaTerms ?? []));
  const [hasPlan, setHasPlan] = useState(Boolean(contract ? contract.instalmentPlan : true));
  const [frequency, setFrequency] = useState<Schemas["InstalmentFrequency"]>(
    contract?.instalmentPlan?.frequency ?? "monthly",
  );
  const [dueDay, setDueDay] = useState(String(contract?.instalmentPlan?.dueDay ?? 5));
  const [amount, setAmount] = useState(contract?.instalmentPlan?.amount ?? "");
  const [vat, setVat] = useState(
    contract?.instalmentPlan?.vatAmount && contract.instalmentPlan.vatAmount !== "0.00"
      ? contract.instalmentPlan.vatAmount
      : "",
  );
  const [firstDueOn, setFirstDueOn] = useState<string | null>(contract?.instalmentPlan?.firstDueOn ?? null);
  const [accountId, setAccountId] = useState(contract?.expenseAccountId ?? "");
  const [whtKey, setWhtKey] = useState(contract?.whtKey ?? "");
  const [penalty, setPenalty] = useState(contract?.penaltyClauses ?? "");
  const [roundId, setRoundId] = useState(contract?.quotationRoundId ?? "");
  const [resolutionId, setResolutionId] = useState(contract?.resolutionId ?? "");
  const [note, setNote] = useState(contract?.note ?? "");
  const [pending, setPending] = useState<Pending[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const action = useApiAction<Schemas["VendorContractDetailDto"]>({ refresh: false });

  const apiErrors: Record<string, string> = isApiError(action.error)
    ? Object.fromEntries(action.error.errors.map((error) => [`contract-${toFieldName(error.path)}`, error.message]))
    : {};
  const errors = { ...apiErrors, ...local };
  const vendor = vendors.find((candidate) => candidate.id === vendorId) ?? null;
  const vendorRounds = rounds.filter((round) => round.vendorId === vendorId && round.buildingId === buildingId);
  const buildingResolutions = resolutions.filter((resolution) => resolution.buildingId === buildingId);
  const rate = rates.find((candidate) => candidate.key === whtKey) ?? null;
  const valueSatang = parseSatang(value);
  const limit = threshold ? decimalSatang(threshold) : null;
  const aboveThreshold = valueSatang !== null && limit !== null && valueSatang > limit;
  const basisMet = Boolean(roundId) || (Boolean(contract?.renewsContractId) && Boolean(resolutionId));
  const slaCheck = slaTerms(sla);

  const updateSla = (priority: Priority, patch: Partial<SlaRowInput>) =>
    setSla((rows) => rows.map((row) => (row.priority === priority ? { ...row, ...patch } : row)));

  const validate = () => {
    const found: Record<string, string> = {};
    if (!buildingId) found["contract-buildingId"] = t("error.building");
    if (!vendorId) found["contract-vendorId"] = t("error.vendor");
    if (!title.trim()) found["contract-title"] = t("error.title");
    if (!startsOn) found["contract-startsOn"] = t("error.startsOn");
    if (!endsOn) found["contract-endsOn"] = t("error.endsOn");
    else if (startsOn && endsOn <= startsOn) found["contract-endsOn"] = t("error.order");
    const days = Number(noticeDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) found["contract-renewalNoticeDays"] = t("error.noticeDays");
    if (valueSatang === null || valueSatang <= 0n) found["contract-value"] = t("error.value");
    for (const priority of PRIORITIES) {
      const problem = slaCheck.problems[priority];
      if (problem) found[`contract-sla-${priority}`] = t(`error.sla.${problem}`, { priority: priorityWords(priority) });
    }
    if (hasPlan) {
      const day = Number(dueDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) found["contract-dueDay"] = t("error.dueDay");
      const each = parseSatang(amount);
      if (each === null || each <= 0n) found["contract-amount"] = t("error.amount");
      if (vat.trim()) {
        const part = parseSatang(vat);
        if (part === null || (each !== null && part > each)) found["contract-vat"] = t("error.vat");
      }
      if (!accountId) found["contract-account"] = t("error.account");
      if (firstDueOn && startsOn && endsOn && (firstDueOn < startsOn || firstDueOn > endsOn))
        found["contract-firstDueOn"] = t("error.firstDueOn");
    }
    return found;
  };

  const planBody = () =>
    hasPlan
      ? {
          frequency,
          dueDay: Number(dueDay),
          amount: normaliseAmount(amount)!,
          ...(vat.trim() ? { vatAmount: normaliseAmount(vat)! } : {}),
          ...(firstDueOn ? { firstDueOn } : {}),
        }
      : null;

  const submit = () => {
    const found = validate();
    setLocal(found);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length) return;
    const shared = {
      title: title.trim(),
      startsOn: startsOn!,
      endsOn: endsOn!,
      renewalNoticeDays: Number(noticeDays),
      value: normaliseAmount(value)!,
      slaTerms: slaCheck.terms,
    };
    void action.run(
      async () => {
        const saved = contract
          ? await unwrap(
              browserApi().PATCH("/v1/owner/juristic/vendor-contracts/{contractId}", {
                params: { path: { contractId: contract.id } },
                body: {
                  ...shared,
                  category: (category || null) as Schemas["VendorCategory"] | null,
                  scope: scope.trim() || null,
                  instalmentPlan: planBody(),
                  expenseAccountId: hasPlan ? accountId || null : accountId || null,
                  whtKey: whtKey || null,
                  penaltyClauses: penalty.trim() || null,
                  quotationRoundId: roundId || null,
                  resolutionId: resolutionId || null,
                  note: note.trim() || null,
                  version: contract.version,
                },
              }),
            )
          : await unwrap(
              browserApi().POST("/v1/owner/juristic/vendor-contracts", {
                body: {
                  ...shared,
                  buildingId,
                  vendorId: vendorId!,
                  ...(category ? { category: category as Schemas["VendorCategory"] } : {}),
                  ...(scope.trim() ? { scope: scope.trim() } : {}),
                  ...(hasPlan ? { instalmentPlan: planBody()! } : {}),
                  ...(accountId ? { expenseAccountId: accountId } : {}),
                  ...(whtKey ? { whtKey } : {}),
                  ...(penalty.trim() ? { penaltyClauses: penalty.trim() } : {}),
                  ...(roundId ? { quotationRoundId: roundId } : {}),
                  ...(resolutionId ? { resolutionId } : {}),
                  ...(note.trim() ? { note: note.trim() } : {}),
                },
              }),
            );
        let latest = saved;
        for (const item of pending) {
          const stored = await uploadOwnerFile(item.file, {
            kind: "other",
            scopeType: "building",
            scopeId: buildingId,
            title: item.file.name,
          });
          latest = await unwrap(
            browserApi().POST("/v1/owner/juristic/vendor-contracts/{contractId}/documents", {
              params: { path: { contractId: saved.id } },
              body: { documentId: stored.id, kind: item.kind },
            }),
          );
        }
        return latest;
      },
      (saved) => window.location.assign(ownerPath(locale, `/juristic/contracts/${saved.id}`)),
    );
  };

  const save = (
    <Button onClick={submit} loading={action.busy} data-testid="contract-save">
      {contract ? t("saveEdit") : t("save")}
    </Button>
  );
  const planSentence =
    hasPlan && parseSatang(amount) !== null && Number(dueDay) >= 1
      ? planWords("words", {
          amount: formatTHB(normaliseAmount(amount)!, locale),
          frequency: planWords(`frequency.${frequency}`),
          day: Number(dueDay),
          first: firstDueOn ? formatDate(firstDueOn, locale) : "",
          hasFirst: firstDueOn ? "yes" : "no",
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: Object.keys(errors).length })}
        items={Object.entries(errors).map(([key, message]) => ({ fieldId: key, message }))}
        focusKey={attempt}
        testId="contract-errors"
      />
      <FormColumns
        summary={
          <FormSummary
            title={t("summary.title")}
            rows={[
              { key: "vendor", label: t("summary.vendor"), value: vendor?.name ?? t("summary.none") },
              {
                key: "term",
                label: t("summary.term"),
                value:
                  startsOn && endsOn
                    ? t("summary.termValue", { from: formatDate(startsOn, locale), to: formatDate(endsOn, locale) })
                    : t("summary.none"),
              },
              {
                key: "value",
                label: t("summary.value"),
                value: valueSatang !== null ? formatTHB(normaliseAmount(value)!, locale) : t("summary.none"),
              },
              {
                key: "plan",
                label: t("summary.plan"),
                value: planSentence ?? (hasPlan ? t("summary.none") : t("summary.noPlan")),
              },
              {
                key: "sla",
                label: t("summary.sla"),
                value: t("summary.slaCount", { count: slaCheck.terms.length }),
              },
            ]}
            action={save}
            note={
              threshold ? (
                <span className="flex flex-col gap-2" data-testid="contract-rule">
                  <span>{t("rule.text", { threshold: formatTHB(threshold, locale) })}</span>
                  {aboveThreshold ? (
                    basisMet ? (
                      <StatusText tone="success" icon={IconCheckCircle} size="sm">
                        {roundId ? t("rule.round") : t("rule.resolution")}
                      </StatusText>
                    ) : (
                      <StatusText tone="warning" icon={IconAlert} size="sm" state="missing">
                        {t("rule.missing")}
                      </StatusText>
                    )
                  ) : valueSatang !== null ? (
                    <StatusText tone="muted" icon={IconInfo} size="sm">
                      {t("rule.below")}
                    </StatusText>
                  ) : null}
                </span>
              ) : (
                t("summary.note")
              )
            }
          />
        }
      >
        <FormSection number={1} title={t("section.parties")} description={t("section.partiesHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required error={errors["contract-buildingId"]}>
              <NativeSelect
                id="contract-buildingId"
                value={buildingId}
                disabled={Boolean(contract)}
                onChange={(event) => {
                  setBuildingId(event.target.value);
                  setRoundId("");
                  setResolutionId("");
                }}
                options={buildings.map((building) => ({ value: building.id, label: building.name }))}
                data-testid="contract-building"
              />
            </Field>
            <Field label={t("vendor")} required error={errors["contract-vendorId"]}>
              {contract ? (
                <Input value={contract.vendorName} disabled readOnly />
              ) : (
                <Combobox
                  options={vendors.map((option) => ({
                    value: option.id,
                    label: option.name,
                    description: option.categories.map((entry) => categoryWords(entry)).join(" · ") || undefined,
                  }))}
                  value={vendorId}
                  onChange={(next) => {
                    setVendorId(next);
                    setRoundId("");
                    const picked = vendors.find((candidate) => candidate.id === next);
                    if (picked && !category && picked.categories[0]) setCategory(picked.categories[0]);
                  }}
                  placeholder={t("vendorPlaceholder")}
                  emptyLabel={t("noVendor")}
                  listLabel={t("vendor")}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label={t("titleField")} hint={t("titleHint")} required error={errors["contract-title"]}>
              <Input
                id="contract-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                data-testid="contract-title"
              />
            </Field>
            <Field label={t("category")}>
              <NativeSelect
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder={t("noCategory")}
                options={CATEGORIES.map((entry) => ({ value: entry, label: categoryWords(entry) }))}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("startsOn")} required error={errors["contract-startsOn"]}>
              <DateField name="startsOn" defaultValue={startsOn} onChange={setStartsOn} />
            </Field>
            <Field label={t("endsOn")} required error={errors["contract-endsOn"]}>
              <DateField name="endsOn" defaultValue={endsOn} min={startsOn ?? undefined} onChange={setEndsOn} />
            </Field>
            <Field label={t("noticeDays")} hint={t("noticeDaysHint")} error={errors["contract-renewalNoticeDays"]}>
              <Input
                id="contract-renewalNoticeDays"
                value={noticeDays}
                onChange={(event) => setNoticeDays(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="tabular-nums"
                data-testid="contract-notice-days"
              />
            </Field>
          </div>
          <Field label={t("value")} hint={t("valueHint")} required error={errors["contract-value"]}>
            <Input
              id="contract-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              className="text-end tabular-nums sm:max-w-xs"
              data-testid="contract-value"
            />
          </Field>
        </FormSection>

        <FormSection number={2} title={t("section.scope")} description={t("section.scopeHint")}>
          <Field label={t("scope")}>
            <Textarea
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              rows={4}
              maxLength={8000}
              data-testid="contract-scope"
            />
          </Field>
        </FormSection>

        <FormSection number={3} title={t("section.sla")} description={t("section.slaHint")}>
          <div className="border-border rounded-control overflow-hidden border" data-testid="contract-sla">
            <div className="bg-bg-subtle text-muted grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-2 text-sm">
              <span>{t("slaPriority")}</span>
              <span>{t("slaResponse")}</span>
              <span>{t("slaResolve")}</span>
            </div>
            {sla.map((row) => {
              const problem = errors[`contract-sla-${row.priority}`];
              return (
                <div
                  key={row.priority}
                  className="border-border grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-t px-4 py-2.5"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{priorityWords(row.priority)}</span>
                    {problem ? (
                      <FieldError id={`contract-sla-${row.priority}`} className="font-normal">
                        {problem}
                      </FieldError>
                    ) : null}
                  </span>
                  <Input
                    aria-label={t("slaResponseOf", { priority: priorityWords(row.priority) })}
                    value={row.responseHours}
                    onChange={(event) =>
                      updateSla(row.priority, { responseHours: event.target.value.replace(/\D/g, "") })
                    }
                    inputMode="numeric"
                    placeholder={t("hours")}
                    className="tabular-nums"
                    aria-invalid={problem ? true : undefined}
                    data-testid={`sla-${row.priority}-response`}
                  />
                  <Input
                    aria-label={t("slaResolveOf", { priority: priorityWords(row.priority) })}
                    value={row.resolveHours}
                    onChange={(event) =>
                      updateSla(row.priority, { resolveHours: event.target.value.replace(/\D/g, "") })
                    }
                    inputMode="numeric"
                    placeholder={t("hours")}
                    className="tabular-nums"
                    aria-invalid={problem ? true : undefined}
                    data-testid={`sla-${row.priority}-resolve`}
                  />
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection number={4} title={t("section.plan")} description={t("section.planHint")}>
          <Switch
            checked={hasPlan}
            onCheckedChange={setHasPlan}
            label={t("hasPlan")}
            description={t("hasPlanHint")}
            data-testid="contract-has-plan"
          />
          {hasPlan ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("frequency")} required>
                  <NativeSelect
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value as Schemas["InstalmentFrequency"])}
                    options={FREQUENCIES.map((entry) => ({ value: entry, label: planWords(`frequency.${entry}`) }))}
                    data-testid="contract-frequency"
                  />
                </Field>
                <Field label={t("dueDay")} hint={t("dueDayHint")} required error={errors["contract-dueDay"]}>
                  <Input
                    id="contract-dueDay"
                    value={dueDay}
                    onChange={(event) => setDueDay(event.target.value.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    className="w-24 tabular-nums"
                    data-testid="contract-due-day"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("amount")} hint={t("amountHint")} required error={errors["contract-amount"]}>
                  <Input
                    id="contract-amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    className="text-end tabular-nums"
                    data-testid="contract-amount"
                  />
                </Field>
                <Field label={t("vat")} hint={t("vatHint")} error={errors["contract-vat"]}>
                  <Input
                    id="contract-vat"
                    value={vat}
                    onChange={(event) => setVat(event.target.value)}
                    inputMode="decimal"
                    className="text-end tabular-nums"
                    data-testid="contract-vat"
                  />
                </Field>
                <Field label={t("firstDueOn")} hint={t("firstDueOnHint")} error={errors["contract-firstDueOn"]}>
                  <DateField
                    name="firstDueOn"
                    defaultValue={firstDueOn}
                    min={startsOn ?? undefined}
                    max={endsOn ?? undefined}
                    onChange={setFirstDueOn}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("account")} hint={t("accountHint")} required error={errors["contract-account"]}>
                  <NativeSelect
                    id="contract-account"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    placeholder={t("accountPlaceholder")}
                    options={accounts.map((account) => ({ value: account.id, label: account.label }))}
                    data-testid="contract-account"
                  />
                </Field>
                <Field label={t("wht")} hint={rates.length ? t("whtHint") : t("noRates")}>
                  <NativeSelect
                    value={whtKey}
                    onChange={(event) => setWhtKey(event.target.value)}
                    placeholder={t("noWht")}
                    options={rates.map((entry) => ({
                      value: entry.key,
                      label: entry.verified
                        ? whtRateLabel(entry, locale)
                        : t("rateUnverified", { rate: whtRateLabel(entry, locale) }),
                    }))}
                    data-testid="contract-wht"
                  />
                </Field>
              </div>
              {rate && !rate.verified ? (
                <p className="text-muted m-0 flex flex-wrap items-center gap-2 text-sm">
                  <Badge size="sm" tone="warning">
                    {t("unverified")}
                  </Badge>
                  <span>{t("unverifiedNote")}</span>
                </p>
              ) : null}
              {planSentence ? (
                <p className="bg-bg-subtle rounded-control m-0 p-3 text-sm" data-testid="contract-plan-words">
                  {planSentence} {t("scheduleNote")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted m-0 text-sm">{t("noPlanNote")}</p>
          )}
        </FormSection>

        <FormSection number={5} title={t("section.penalty")} description={t("section.penaltyHint")}>
          <Field label={t("penalty")}>
            <Textarea
              value={penalty}
              onChange={(event) => setPenalty(event.target.value)}
              rows={3}
              maxLength={8000}
              data-testid="contract-penalty"
            />
          </Field>
        </FormSection>

        <FormSection number={6} title={t("section.basis")} description={t("section.basisHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("round")}
              hint={vendorRounds.length ? t("roundHint") : t("noRounds")}
              error={errors["contract-quotationRoundId"]}
            >
              <NativeSelect
                value={roundId}
                onChange={(event) => setRoundId(event.target.value)}
                placeholder={t("roundPlaceholder")}
                options={vendorRounds.map((round) => ({ value: round.id, label: round.label }))}
                data-testid="contract-round"
              />
            </Field>
            <Field
              label={t("resolution")}
              hint={buildingResolutions.length ? t("resolutionHint") : t("noResolutions")}
              error={errors["contract-resolutionId"]}
            >
              <NativeSelect
                value={resolutionId}
                onChange={(event) => setResolutionId(event.target.value)}
                placeholder={t("resolutionPlaceholder")}
                options={buildingResolutions.map((resolution) => ({ value: resolution.id, label: resolution.label }))}
                data-testid="contract-resolution"
              />
            </Field>
          </div>
          {aboveThreshold && !basisMet && threshold ? (
            <div data-testid="contract-rule-callout">
              <Callout tone="warning" title={t("rule.calloutTitle", { threshold: formatTHB(threshold, locale) })}>
                {contract?.renewsContractId ? t("rule.calloutRenewal") : t("rule.calloutBody")}
              </Callout>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("documents")}</span>
            {contract?.documents.length ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                {contract.documents.map((document) => (
                  <li key={document.documentId} className="text-muted">
                    {documentWords(document.kind)}
                  </li>
                ))}
              </ul>
            ) : null}
            {pending.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center gap-3" data-testid="contract-pending-file">
                <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
                <NativeSelect
                  aria-label={t("fileKind", { file: item.file.name })}
                  inputSize="sm"
                  value={item.kind}
                  onChange={(event) =>
                    setPending((all) =>
                      all.map((entry) =>
                        entry.key === item.key
                          ? { ...entry, kind: event.target.value as Schemas["ContractDocumentKind"] }
                          : entry,
                      ),
                    )
                  }
                  options={DOCUMENT_KINDS.map((kind) => ({ value: kind, label: documentWords(kind) }))}
                  className="w-44"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconStart={IconDelete}
                  onClick={() => setPending((all) => all.filter((entry) => entry.key !== item.key))}
                  aria-label={t("removeFile", { file: item.file.name })}
                >
                  <span className="sr-only">{t("removeFile", { file: item.file.name })}</span>
                </Button>
              </div>
            ))}
            <FileDropzone
              label={t("addFile")}
              hint={common("receiptHint")}
              accept="image/*,application/pdf"
              maxBytes={MAX_BYTES}
              tooLargeText={common("tooLarge")}
              chooseText={common("choose")}
              onFiles={(files) =>
                setPending((all) => [
                  ...all,
                  ...files.map((file) => {
                    counter.current += 1;
                    return { key: `f${counter.current}`, file, kind: "contract" as const };
                  }),
                ])
              }
              data-testid="contract-files"
            />
          </div>
          <Field label={t("note")}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} />
          </Field>
        </FormSection>
        <ProblemNotice error={action.error} />
      </FormColumns>
      <MobileActionBar summary={vendor?.name ?? title}>{save}</MobileActionBar>
    </div>
  );
}
