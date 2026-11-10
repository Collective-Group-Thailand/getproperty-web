"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatTHB } from "@/i18n/format";
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
import { FileDropzone } from "@/ui/components/FileDropzone";
import { FormColumns, FormSection, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";

import { ownerPath } from "../../shared/links";
import { uploadOwnerFile } from "../../shared/upload";
import type { ApprovalBand } from "./bands";
import { ATTACHMENT_KINDS } from "./ExpenseActions";
import { normaliseAmount, parseSatang } from "./money";
import { percentText, whtRateLabel, type WhtRate } from "./wht";

const MAX_BYTES = 10 * 1024 * 1024;

interface Line {
  key: string;
  accountId: string;
  description: string;
  amount: string;
  vatAmount: string;
  whtKey: string;
}

interface Pending {
  key: string;
  file: File;
  kind: Schemas["ExpenseAttachmentKind"];
}

export interface PayeeOption {
  id: string;
  name: string;
  /** The party has a tax id (a 50 ทวิ can be issued to it). */
  taxId: boolean;
  company: boolean;
}

/** J2.2 (D-331): a vendor the request may pay, with its active contracts and the rounds awarded to it. */
export interface VendorOption {
  id: string;
  name: string;
  taxIdHint: string | null;
}

export interface VendorLinks {
  vendors: VendorOption[];
  contracts: { id: string; vendorId: string; buildingId: string; label: string }[];
  rounds: { id: string; vendorId: string; buildingId: string; label: string }[];
  /** `juristic.quotation_threshold` (text for the note); null when the settings do not say. */
  threshold: string | null;
}

/**
 * A new expense request — or a draft being edited — as a numbered form (J2.1 §3): 1 payee and building, 2 lines by
 * expense account (amount incl. VAT, the VAT part, a WHT rate from `juristic.wht_rates` with "อัตรารอยืนยัน" while a
 * rate is unverified, O-041), 3 where the money comes from (the operating account, or a fund with an adopted
 * resolution — D-311), 4 attachments, 5 a note. It saves a draft; the record then shows the API's totals and the band,
 * and sends it for approval. Nothing is summed here.
 */
export function ExpenseForm({
  buildings,
  accounts,
  rates,
  bands,
  payees,
  funds,
  resolutions,
  defaultBuildingId,
  draft,
  links,
}: {
  buildings: { id: string; name: string }[];
  accounts: { id: string; label: string }[];
  rates: WhtRate[];
  bands: ApprovalBand[];
  payees: PayeeOption[];
  funds: { id: string; buildingId: string; name: string }[];
  resolutions: { id: string; buildingId: string; label: string }[];
  defaultBuildingId?: string;
  draft?: Schemas["ExpenseRequestDto"];
  links?: VendorLinks;
}) {
  const t = useTranslations("owner.accounting.expenseForm");
  const vendorWords = useTranslations("owner.vendors.expense");
  const bandWords = useTranslations("owner.accounting.band");
  const kinds = useTranslations("owner.accounting.attachmentKind");
  const common = useTranslations("owner.accounting.common");
  const locale = useLocale() as Locale;
  const counter = useRef(10);
  const [buildingId, setBuildingId] = useState(draft?.buildingId ?? defaultBuildingId ?? buildings[0]?.id ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [payeeId, setPayeeId] = useState<string | null>(draft?.payeePartyId ?? null);
  const [payeeName, setPayeeName] = useState(draft && !draft.payeePartyId ? draft.payeeName : "");
  const [vendorId, setVendorId] = useState<string | null>(draft?.vendorId ?? null);
  const [contractId, setContractId] = useState(draft?.vendorContractId ?? "");
  const [roundId, setRoundId] = useState(draft?.quotationRoundId ?? "");
  const [source, setSource] = useState<"operating" | "fund">(draft?.fundId ? "fund" : "operating");
  const [fundId, setFundId] = useState(draft?.fundId ?? "");
  const [resolutionId, setResolutionId] = useState(draft?.resolutionId ?? "");
  const [note, setNote] = useState(draft?.note ?? "");
  const [lines, setLines] = useState<Line[]>(
    draft?.lines.length
      ? draft.lines.map((line) => ({
          key: `d${line.lineNo}`,
          accountId: line.accountId,
          description: line.description,
          amount: line.amount,
          vatAmount: line.vatAmount === "0.00" ? "" : line.vatAmount,
          whtKey: line.whtKey ?? "",
        }))
      : [{ key: "l1", accountId: "", description: "", amount: "", vatAmount: "", whtKey: "" }],
  );
  const [pending, setPending] = useState<Pending[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const action = useApiAction<Schemas["ExpenseRequestDto"]>({ refresh: false });

  const apiErrors: Record<string, string> = isApiError(action.error)
    ? Object.fromEntries(action.error.errors.map((error) => [toFieldName(error.path), error.message]))
    : {};
  const errors = { ...apiErrors, ...local };
  const payee = payees.find((candidate) => candidate.id === payeeId) ?? null;
  const vendor = links?.vendors.find((candidate) => candidate.id === vendorId) ?? null;
  const vendorContracts = (links?.contracts ?? []).filter(
    (contract) => contract.vendorId === vendorId && contract.buildingId === buildingId,
  );
  const vendorRounds = (links?.rounds ?? []).filter(
    (round) => round.vendorId === vendorId && round.buildingId === buildingId,
  );
  const usedRates = lines.map((line) => rates.find((rate) => rate.key === line.whtKey)).filter(Boolean) as WhtRate[];
  const unverified = usedRates.some((rate) => !rate.verified);
  const needsTaxId = usedRates.length > 0 && (vendor ? !vendor.taxIdHint : !payee || !payee.taxId);
  const buildingFunds = funds.filter((fund) => fund.buildingId === buildingId);
  const buildingResolutions = resolutions.filter((resolution) => resolution.buildingId === buildingId);
  const fieldId = (key: string, part: string) => `expense-${key}-${part}`;

  const update = (key: string, patch: Partial<Line>) =>
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const addLine = () => {
    counter.current += 1;
    setLines((all) => [
      ...all,
      { key: `l${counter.current}`, accountId: "", description: "", amount: "", vatAmount: "", whtKey: "" },
    ]);
  };

  const validate = () => {
    const found: Record<string, string> = {};
    if (!buildingId) found["expense-building"] = t("error.building");
    if (!title.trim()) found["expense-title"] = t("error.title");
    if (!vendor && !payeeId && !payeeName.trim()) found["expense-payee"] = t("error.payee");
    lines.forEach((line, index) => {
      if (!line.accountId) found[fieldId(line.key, "account")] = t("error.account", { n: index + 1 });
      if (!line.description.trim()) found[fieldId(line.key, "description")] = t("error.description", { n: index + 1 });
      const amount = parseSatang(line.amount);
      if (amount === null || amount <= 0n) found[fieldId(line.key, "amount")] = t("error.amount", { n: index + 1 });
      if (line.vatAmount.trim()) {
        const vat = parseSatang(line.vatAmount);
        if (vat === null || (amount !== null && vat > amount))
          found[fieldId(line.key, "vat")] = t("error.vat", { n: index + 1 });
      }
    });
    if (source === "fund") {
      if (!fundId) found["expense-fund"] = t("error.fund");
      if (!resolutionId) found["expense-resolution"] = t("error.resolution");
    }
    return found;
  };

  const submit = () => {
    const found = validate();
    setLocal(found);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length) return;
    const body = {
      title: title.trim(),
      ...(vendor ? {} : payeeId ? { payeePartyId: payeeId } : { payeeName: payeeName.trim() }),
      lines: lines.map((line) => ({
        accountId: line.accountId,
        description: line.description.trim(),
        amount: normaliseAmount(line.amount)!,
        ...(line.vatAmount.trim() ? { vatAmount: normaliseAmount(line.vatAmount)! } : {}),
        ...(line.whtKey ? { whtKey: line.whtKey } : {}),
      })),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    void action.run(
      async () => {
        const saved = draft
          ? await unwrap(
              browserApi().PATCH("/v1/owner/juristic/expense-requests/{expenseRequestId}", {
                params: { path: { expenseRequestId: draft.id } },
                body: {
                  ...body,
                  ...(vendor ? {} : payeeId ? { payeeName: payee?.name } : { payeePartyId: null }),
                  ...(links
                    ? {
                        vendorId: vendor?.id ?? null,
                        vendorContractId: vendor && contractId ? contractId : null,
                        quotationRoundId: vendor && roundId ? roundId : null,
                      }
                    : {}),
                  note: note.trim() || null,
                  fundId: source === "fund" ? fundId : null,
                  resolutionId: source === "fund" ? resolutionId : null,
                  version: draft.version,
                },
              }),
            )
          : await unwrap(
              browserApi().POST("/v1/owner/juristic/expense-requests", {
                body: {
                  ...body,
                  buildingId,
                  kind: "expense",
                  ...(source === "fund" ? { fundId, resolutionId } : {}),
                  ...(vendor
                    ? {
                        vendorId: vendor.id,
                        ...(contractId ? { vendorContractId: contractId } : {}),
                        ...(roundId ? { quotationRoundId: roundId } : {}),
                      }
                    : {}),
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
            browserApi().POST("/v1/owner/juristic/expense-requests/{expenseRequestId}/attachments", {
              params: { path: { expenseRequestId: saved.id } },
              body: { documentId: stored.id, kind: item.kind },
            }),
          );
        }
        return latest;
      },
      (saved) => window.location.assign(ownerPath(locale, `/juristic/expenses/${saved.id}`)),
    );
  };

  const save = (testId: string) => (
    <Button onClick={submit} loading={action.busy} data-testid={testId}>
      {draft ? t("saveEdit") : t("save")}
    </Button>
  );
  const bandRow = (band: ApprovalBand, index: number) => {
    const previous = index > 0 ? bands[index - 1]?.upTo : null;
    const range =
      band.upTo === null
        ? previous
          ? bandWords("above", { amount: formatTHB(previous, locale) })
          : bandWords("any")
        : bandWords("upTo", { amount: formatTHB(band.upTo, locale) });
    return { key: `band-${index}`, label: range, value: bandWords("people", { count: band.approvals }) };
  };

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: Object.keys(errors).length })}
        items={Object.entries(errors).map(([key, message]) => ({ fieldId: key, message }))}
        focusKey={attempt}
        testId="expense-errors"
      />
      <FormColumns
        summary={
          <FormSummary
            title={t("summary.title")}
            rows={[
              { key: "lines", label: t("summary.lines"), value: t("summary.count", { count: lines.length }) },
              {
                key: "files",
                label: t("summary.files"),
                value: t("summary.count", { count: pending.length + (draft?.attachments.length ?? 0) }),
              },
              ...bands.map(bandRow),
            ]}
            action={save("expense-save")}
            note={t("summary.note")}
          />
        }
      >
        <FormSection number={1} title={t("section.payee")} description={t("section.payeeHint")}>
          <Field label={t("titleField")} hint={t("titleHint")} required error={errors["expense-title"] ?? errors.title}>
            <Input
              id="expense-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              data-testid="expense-title"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required error={errors["expense-building"]}>
              <NativeSelect
                id="expense-building"
                value={buildingId}
                disabled={Boolean(draft)}
                onChange={(event) => setBuildingId(event.target.value)}
                options={buildings.map((building) => ({ value: building.id, label: building.name }))}
                data-testid="expense-building"
              />
            </Field>
            {links && links.vendors.length ? (
              <Field label={vendorWords("vendor")} hint={vendorWords("vendorHint")} error={errors.vendorId}>
                <Combobox
                  options={links.vendors.map((option) => ({
                    value: option.id,
                    label: option.name,
                    description: option.taxIdHint
                      ? vendorWords("taxIdHint", { last: option.taxIdHint })
                      : vendorWords("noTaxId"),
                  }))}
                  value={vendorId}
                  onChange={(value) => {
                    setVendorId(value);
                    setContractId("");
                    setRoundId("");
                  }}
                  placeholder={vendorWords("vendorPlaceholder")}
                  emptyLabel={vendorWords("noVendor")}
                  listLabel={vendorWords("vendor")}
                />
              </Field>
            ) : null}
            {vendor ? null : (
              <Field
                label={t("payee")}
                hint={t("payeeHint")}
                required
                error={errors["expense-payee"] ?? errors.payeeName}
              >
                <Combobox
                  options={payees.map((option) => ({
                    value: option.id,
                    label: option.name,
                    description: option.taxId ? t("hasTaxId") : t("noTaxId"),
                  }))}
                  value={payeeId}
                  onChange={(value) => setPayeeId(value)}
                  placeholder={t("payeePlaceholder")}
                  emptyLabel={t("noPayee")}
                  listLabel={t("payee")}
                />
              </Field>
            )}
          </div>
          {vendor ? (
            <div className="flex flex-col gap-4" data-testid="expense-vendor-links">
              <p className="text-muted m-0 text-sm">{vendorWords("payeeFromVendor", { vendor: vendor.name })}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={vendorWords("contract")}
                  hint={vendorContracts.length ? vendorWords("contractHint") : vendorWords("noContracts")}
                  error={errors.vendorContractId}
                >
                  <NativeSelect
                    value={contractId}
                    onChange={(event) => setContractId(event.target.value)}
                    placeholder={vendorWords("noContract")}
                    options={vendorContracts.map((contract) => ({ value: contract.id, label: contract.label }))}
                    data-testid="expense-contract"
                  />
                </Field>
                <Field
                  label={vendorWords("round")}
                  hint={vendorRounds.length ? vendorWords("roundHint") : vendorWords("noRounds")}
                  error={errors.quotationRoundId}
                >
                  <NativeSelect
                    value={roundId}
                    onChange={(event) => setRoundId(event.target.value)}
                    placeholder={vendorWords("noRound")}
                    options={vendorRounds.map((round) => ({ value: round.id, label: round.label }))}
                    data-testid="expense-round"
                  />
                </Field>
              </div>
              {!contractId && !roundId && links?.threshold ? (
                <div data-testid="expense-quotation-rule">
                  <Callout
                    tone="info"
                    title={vendorWords("ruleTitle", { threshold: formatTHB(links.threshold, locale) })}
                  >
                    {vendorWords("ruleBody")}
                  </Callout>
                </div>
              ) : null}
            </div>
          ) : null}
          {vendor || payeeId ? null : (
            <Field label={t("payeeName")} hint={t("payeeNameHint")}>
              <Input
                id="expense-payee"
                value={payeeName}
                onChange={(event) => setPayeeName(event.target.value)}
                maxLength={200}
                data-testid="expense-payee-name"
              />
            </Field>
          )}
        </FormSection>

        <FormSection number={2} title={t("section.lines")} description={t("section.linesHint")}>
          <div className="flex flex-col gap-4" data-testid="expense-lines-form">
            {lines.map((line, index) => (
              <fieldset
                key={line.key}
                className="border-border rounded-control flex flex-col gap-3 border p-4"
                data-testid="expense-line-input"
              >
                <legend className="text-muted px-1 text-sm">{t("lineN", { n: index + 1 })}</legend>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label={t("account")} required error={errors[fieldId(line.key, "account")]}>
                    <NativeSelect
                      id={fieldId(line.key, "account")}
                      value={line.accountId}
                      onChange={(event) => update(line.key, { accountId: event.target.value })}
                      placeholder={t("accountPlaceholder")}
                      options={accounts.map((account) => ({ value: account.id, label: account.label }))}
                      data-testid="expense-line-account"
                    />
                  </Field>
                  <Field label={t("description")} required error={errors[fieldId(line.key, "description")]}>
                    <Input
                      id={fieldId(line.key, "description")}
                      value={line.description}
                      onChange={(event) => update(line.key, { description: event.target.value })}
                      maxLength={300}
                      data-testid="expense-line-description"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-[10rem_10rem_minmax(0,1fr)_auto]">
                  <Field
                    label={t("amount")}
                    hint={t("amountHint")}
                    required
                    error={errors[fieldId(line.key, "amount")]}
                  >
                    <Input
                      id={fieldId(line.key, "amount")}
                      value={line.amount}
                      onChange={(event) => update(line.key, { amount: event.target.value })}
                      inputMode="decimal"
                      className="text-end tabular-nums"
                      data-testid="expense-line-amount"
                    />
                  </Field>
                  <Field label={t("vat")} hint={t("vatHint")} error={errors[fieldId(line.key, "vat")]}>
                    <Input
                      id={fieldId(line.key, "vat")}
                      value={line.vatAmount}
                      onChange={(event) => update(line.key, { vatAmount: event.target.value })}
                      inputMode="decimal"
                      className="text-end tabular-nums"
                      data-testid="expense-line-vat"
                    />
                  </Field>
                  <Field
                    label={t("wht")}
                    hint={rates.length ? t("whtHint") : t("noRates")}
                    className="col-span-2 md:col-span-1"
                  >
                    <NativeSelect
                      value={line.whtKey}
                      onChange={(event) => update(line.key, { whtKey: event.target.value })}
                      placeholder={t("noWht")}
                      options={rates.map((rate) => ({
                        value: rate.key,
                        label: rate.verified
                          ? whtRateLabel(rate, locale)
                          : t("rateUnverified", { rate: whtRateLabel(rate, locale) }),
                      }))}
                      data-testid="expense-line-wht"
                    />
                  </Field>
                  <div className="col-span-2 flex items-end justify-end md:col-span-1">
                    <Button
                      variant="ghost"
                      iconStart={IconDelete}
                      disabled={lines.length <= 1}
                      onClick={() => setLines((all) => all.filter((item) => item.key !== line.key))}
                      aria-label={t("removeLine", { n: index + 1 })}
                    >
                      <span className="sr-only">{t("removeLine", { n: index + 1 })}</span>
                    </Button>
                  </div>
                </div>
                {line.whtKey ? <WhtLineNote rate={rates.find((rate) => rate.key === line.whtKey) ?? null} /> : null}
              </fieldset>
            ))}
            <div>
              <Button
                variant="secondary"
                size="sm"
                iconStart={IconAdd}
                onClick={addLine}
                data-testid="expense-add-line"
              >
                {t("addLine")}
              </Button>
            </div>
            {unverified ? (
              <div data-testid="expense-wht-unverified">
                <Callout tone="warning" title={t("unverifiedTitle")}>
                  {t("unverifiedBody")}
                </Callout>
              </div>
            ) : null}
            {needsTaxId ? (
              <div data-testid="expense-tax-id-missing">
                <Callout tone="info" title={t("taxIdTitle")}>
                  {t("taxIdBody")}
                </Callout>
              </div>
            ) : null}
          </div>
        </FormSection>

        <FormSection number={3} title={t("section.source")} description={t("section.sourceHint")}>
          <SegmentedControl
            label={t("section.source")}
            value={source}
            onValueChange={(value) => setSource(value as "operating" | "fund")}
            options={[
              { value: "operating", label: t("operating") },
              { value: "fund", label: t("fund") },
            ]}
          />
          {source === "fund" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("fundPick")}
                hint={buildingFunds.length ? undefined : t("noFunds")}
                required
                error={errors["expense-fund"]}
              >
                <NativeSelect
                  id="expense-fund"
                  value={fundId}
                  onChange={(event) => setFundId(event.target.value)}
                  placeholder={t("fundPlaceholder")}
                  options={buildingFunds.map((fund) => ({ value: fund.id, label: fund.name }))}
                  data-testid="expense-fund"
                />
              </Field>
              <Field
                label={t("resolution")}
                hint={buildingResolutions.length ? t("resolutionHint") : t("noResolutions")}
                required
                error={errors["expense-resolution"]}
              >
                <NativeSelect
                  id="expense-resolution"
                  value={resolutionId}
                  onChange={(event) => setResolutionId(event.target.value)}
                  placeholder={t("resolutionPlaceholder")}
                  options={buildingResolutions.map((resolution) => ({ value: resolution.id, label: resolution.label }))}
                  data-testid="expense-resolution"
                />
              </Field>
            </div>
          ) : (
            <p className="text-muted m-0 text-sm">{t("operatingHint")}</p>
          )}
        </FormSection>

        <FormSection number={4} title={t("section.files")} description={t("section.filesHint")}>
          {draft?.attachments.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {draft.attachments.map((attachment, index) => (
                <li key={`${attachment.documentId}-${index}`} className="text-muted">
                  {kinds(attachment.kind)}
                </li>
              ))}
            </ul>
          ) : null}
          {pending.map((item) => (
            <div key={item.key} className="flex flex-wrap items-center gap-3" data-testid="expense-pending-file">
              <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
              <NativeSelect
                aria-label={t("fileKind", { file: item.file.name })}
                inputSize="sm"
                value={item.kind}
                onChange={(event) =>
                  setPending((all) =>
                    all.map((entry) =>
                      entry.key === item.key
                        ? { ...entry, kind: event.target.value as Schemas["ExpenseAttachmentKind"] }
                        : entry,
                    ),
                  )
                }
                options={ATTACHMENT_KINDS.filter((kind) => kind !== "payment_evidence").map((kind) => ({
                  value: kind,
                  label: kinds(kind),
                }))}
                className="w-40"
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
                  return { key: `f${counter.current}`, file, kind: "quotation" as const };
                }),
              ])
            }
            data-testid="expense-files"
          />
        </FormSection>

        <FormSection number={5} title={t("section.note")} description={t("section.noteHint")}>
          <Field label={t("note")}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              data-testid="expense-note"
            />
          </Field>
        </FormSection>
        <ProblemNotice error={action.error} />
      </FormColumns>
      <MobileActionBar summary={t("summary.mobile", { count: lines.length })}>
        {save("expense-save-mobile")}
      </MobileActionBar>
    </div>
  );
}

/** Under a line with WHT: the rate and income type printed on the 50 ทวิ, and the O-041 badge while unconfirmed. */
function WhtLineNote({ rate }: { rate: WhtRate | null }) {
  const t = useTranslations("owner.accounting.expenseForm");
  if (!rate) return null;
  return (
    <p className="text-muted m-0 flex flex-wrap items-center gap-2 text-sm" data-testid="expense-line-wht-note">
      <span>{t("whtLine", { rate: percentText(rate.ratePct), type: rate.incomeType })}</span>
      {rate.verified ? null : (
        <Badge size="sm" tone="warning">
          {t("unverifiedBadge")}
        </Badge>
      )}
    </p>
  );
}
