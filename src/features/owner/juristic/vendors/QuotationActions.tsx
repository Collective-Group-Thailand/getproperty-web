"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Combobox } from "@/ui/components/Combobox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconQuotation } from "@/ui/icons/glyphs/quotation";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../../shared/links";
import { uploadOwnerFile } from "../../shared/upload";
import { normaliseAmount, parseSatang } from "../accounting/money";
import { whtRateLabel, type WhtRate } from "../accounting/wht";
import { awardNeedsReason, compareQuotations, quoteExpired, REASON_MAX, REASON_MIN, reasonProblem } from "./quotations";

type Round = Schemas["QuotationRoundDto"];
const MAX_BYTES = 10 * 1024 * 1024;
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

/** Opens a quotation round in a building: what to buy or hire, its kind and an optional estimate. */
export function NewRoundButton({
  buildings,
  defaultBuildingId,
  variant = "primary",
}: {
  buildings: { id: string; name: string }[];
  defaultBuildingId?: string;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("owner.vendors.roundAction");
  const categories = useTranslations("owner.vendors.category");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant={variant}
      testId={variant === "primary" ? "round-new" : "round-new-empty"}
      title={t("newTitle")}
      description={t("newBody")}
      submitLabel={t("newSubmit")}
      successMessage={t("opened")}
      size_="lg"
      onSubmit={(data) => {
        const title = text(data, "title");
        if (!title) invalidField("title", t("error.title"));
        const estimate = text(data, "estimatedAmount");
        const normalised = estimate ? normaliseAmount(estimate) : null;
        if (estimate && !normalised) invalidField("estimatedAmount", t("error.amount"));
        const category = text(data, "category");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/quotation-rounds", {
            body: {
              buildingId: text(data, "buildingId") ?? "",
              title: title!,
              ...(category ? { category: category as Schemas["VendorCategory"] } : {}),
              ...(normalised ? { estimatedAmount: normalised } : {}),
              ...(text(data, "description") ? { description: text(data, "description") } : {}),
            },
          }),
        );
      }}
      onDone={(result) => window.location.assign(ownerPath(locale, `/juristic/quotations/${(result as Round).id}`))}
    >
      {(errors) => (
        <>
          <Field label={t("title")} hint={t("titleHint")} required error={errors.title}>
            <Input name="title" maxLength={200} data-testid="round-title" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required error={errors.buildingId}>
              <NativeSelect
                name="buildingId"
                defaultValue={defaultBuildingId ?? buildings[0]?.id}
                options={buildings.map((building) => ({ value: building.id, label: building.name }))}
                data-testid="round-building"
              />
            </Field>
            <Field label={t("category")}>
              <NativeSelect
                name="category"
                defaultValue=""
                placeholder={t("noCategory")}
                options={CATEGORIES.map((value) => ({ value, label: categories(value) }))}
                data-testid="round-category"
              />
            </Field>
          </div>
          <Field label={t("estimate")} hint={t("estimateHint")} error={errors.estimatedAmount}>
            <Input
              name="estimatedAmount"
              inputMode="decimal"
              className="text-end tabular-nums sm:max-w-xs"
              data-testid="round-estimate"
            />
          </Field>
          <Field label={t("description")} hint={t("descriptionHint")}>
            <Textarea name="description" rows={3} maxLength={4000} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * Records one vendor's quotation (one per vendor; only while the round is open): the amount including VAT, the VAT
 * part, valid until, the day it came, the document (required) and a note.
 */
export function AddQuotationButton({
  round,
  vendors,
  today,
  variant,
}: {
  round: Round;
  vendors: { id: string; name: string; description?: string }[];
  today: string;
  variant: "primary" | "secondary";
}) {
  const t = useTranslations("owner.vendors.roundAction");
  const common = useTranslations("owner.accounting.common");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const quoted = new Set(round.quotations.map((quote) => quote.vendorId));
  const choices = vendors.filter((vendor) => !quoted.has(vendor.id));
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant={variant}
      testId="round-add-quotation"
      title={t("addTitle", { title: round.title })}
      description={t("addBody", { count: round.quotations.length })}
      submitLabel={t("addSubmit")}
      successMessage={t("added")}
      size_="lg"
      onSubmit={async (data) => {
        if (!vendorId) invalidField("vendorId", t("error.vendor"));
        const amount = normaliseAmount(text(data, "amount"));
        if (!amount || parseSatang(amount)! <= 0n) invalidField("amount", t("error.amount"));
        const vatText = text(data, "vatAmount");
        const vat = vatText ? normaliseAmount(vatText) : null;
        if (vatText && (!vat || parseSatang(vat)! > parseSatang(amount!)!)) invalidField("vatAmount", t("error.vat"));
        const validUntil = text(data, "validUntil");
        if (!validUntil) invalidField("validUntil", t("error.validUntil"));
        if (!file) invalidField("documentId", t("error.document"));
        const stored = await uploadOwnerFile(file!, {
          kind: "other",
          scopeType: "building",
          scopeId: round.buildingId,
          title: file!.name,
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/quotation-rounds/{roundId}/quotations", {
            params: { path: { roundId: round.id } },
            body: {
              vendorId: vendorId!,
              amount: amount!,
              ...(vat ? { vatAmount: vat } : {}),
              validUntil: validUntil!,
              ...(text(data, "receivedOn") ? { receivedOn: text(data, "receivedOn") } : {}),
              documentId: stored.id,
              ...(text(data, "note") ? { note: text(data, "note") } : {}),
            },
          }),
        );
      }}
      onDone={() => {
        setVendorId(null);
        setFile(null);
      }}
    >
      {(errors) => (
        <>
          <Field label={t("vendor")} hint={t("vendorHint")} required error={errors.vendorId}>
            <Combobox
              options={choices.map((vendor) => ({
                value: vendor.id,
                label: vendor.name,
                description: vendor.description,
              }))}
              value={vendorId}
              onChange={setVendorId}
              placeholder={t("vendorPlaceholder")}
              emptyLabel={t("noVendor")}
              listLabel={t("vendor")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("amount")} hint={t("amountHint")} required error={errors.amount}>
              <Input
                name="amount"
                inputMode="decimal"
                className="text-end tabular-nums"
                data-testid="quote-amount-input"
              />
            </Field>
            <Field label={t("vat")} hint={t("vatHint")} error={errors.vatAmount}>
              <Input
                name="vatAmount"
                inputMode="decimal"
                className="text-end tabular-nums"
                data-testid="quote-vat-input"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("validUntil")} required error={errors.validUntil}>
              <DateField name="validUntil" min={today} />
            </Field>
            <Field label={t("receivedOn")} hint={t("receivedOnHint")} error={errors.receivedOn}>
              <DateField name="receivedOn" defaultValue={today} max={today} />
            </Field>
          </div>
          <Field label={t("document")} required error={errors.documentId}>
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={t("document")}
                hint={common("receiptHint")}
                accept="image/*,application/pdf"
                maxBytes={MAX_BYTES}
                tooLargeText={common("tooLarge")}
                chooseText={common("choose")}
                onFiles={(files) => setFile(files[0] ?? null)}
                data-testid="quote-document"
              />
              {file ? <p className="text-muted m-0 text-sm">{common("attached", { file: file.name })}</p> : null}
            </div>
          </Field>
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea name="note" rows={2} maxLength={1000} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * The award (D-310): a valid quotation (cheapest first; expired ones cannot be chosen), what it becomes — a contract
 * draft over a term, or an expense request draft on an account — and on what basis: an adopted resolution of the
 * building (awarded at once) or the approval band for the amount (other members approve; the one who asks cannot).
 * Above the threshold with fewer quotations than required, the reason field appears and is required (10–1000).
 */
export function AwardButton({
  round,
  today,
  accounts,
  rates,
  resolutions,
  bandText,
  variant = "primary",
}: {
  round: Round;
  variant?: "primary" | "secondary";
  today: string;
  accounts: { value: string; label: string }[];
  rates: WhtRate[];
  resolutions: { id: string; label: string }[];
  /** "ต้องอนุมัติ 2 คน จาก …" for an amount, from the settings' bands (the API snapshots the band). */
  bandText: Record<string, string>;
}) {
  const t = useTranslations("owner.vendors.award");
  const locale = useLocale() as Locale;
  const ordered = compareQuotations(round.quotations);
  const firstValid = ordered.find((quote) => !quoteExpired(quote, today));
  const [quotationId, setQuotationId] = useState(firstValid?.id ?? "");
  const [outcome, setOutcome] = useState<Schemas["AwardOutcome"]>("contract");
  const [basis, setBasis] = useState<Schemas["AwardBasis"]>("approval");
  const [reason, setReason] = useState("");
  const chosen = round.quotations.find((quote) => quote.id === quotationId) ?? null;
  const needsReason = chosen
    ? awardNeedsReason({
        amount: chosen.amount,
        threshold: round.threshold,
        count: round.quotations.length,
        minimum: round.minimumQuotations,
      })
    : false;
  return (
    <FormDialog
      label={t("button")}
      icon={IconQuotation}
      variant={variant}
      sheet
      testId="round-award"
      title={t("title", { title: round.title })}
      description={t("body")}
      submitLabel={basis === "resolution" ? t("submitResolution") : t("submitApproval")}
      successMessage={basis === "resolution" ? t("awarded") : t("requested")}
      onSubmit={(data, _ack, idempotencyKey) => {
        if (!chosen) invalidField("quotationId", t("error.quotation"));
        if (outcome === "contract") {
          const startsOn = text(data, "startsOn");
          const endsOn = text(data, "endsOn");
          if (!startsOn) invalidField("startsOn", t("error.startsOn"));
          if (!endsOn || endsOn <= startsOn!) invalidField("endsOn", t("error.endsOn"));
        } else if (!text(data, "accountId")) invalidField("accountId", t("error.account"));
        if (basis === "resolution" && !text(data, "resolutionId")) invalidField("resolutionId", t("error.resolution"));
        if (needsReason) {
          const problem = reasonProblem(reason);
          if (problem)
            invalidField("fewerQuotationsReason", t(`error.reason.${problem}`, { min: REASON_MIN, max: REASON_MAX }));
        }
        return unwrap(
          browserApi().POST("/v1/owner/juristic/quotation-rounds/{roundId}/actions/award", {
            params: { path: { roundId: round.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              quotationId: chosen!.id,
              outcome,
              basis,
              ...(outcome === "contract"
                ? { startsOn: text(data, "startsOn")!, endsOn: text(data, "endsOn")! }
                : {
                    accountId: text(data, "accountId")!,
                    ...(text(data, "whtKey") ? { whtKey: text(data, "whtKey") } : {}),
                  }),
              ...(basis === "resolution" ? { resolutionId: text(data, "resolutionId")! } : {}),
              ...(needsReason ? { fewerQuotationsReason: reason.trim() } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("quotation")} required error={errors.quotationId}>
            <RadioCards
              value={quotationId}
              onValueChange={setQuotationId}
              columns={1}
              options={ordered.map((quote, index) => {
                const expired = quoteExpired(quote, today);
                return {
                  value: quote.id,
                  disabled: expired,
                  label: (
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span>{quote.vendorName}</span>
                      <span className="tabular-nums">{formatTHB(quote.amount, locale)}</span>
                    </span>
                  ),
                  description: expired
                    ? t("expired", { date: formatDate(quote.validUntil, locale) })
                    : [
                        index === 0 ? t("lowest") : null,
                        t("validUntil", { date: formatDate(quote.validUntil, locale) }),
                      ]
                        .filter(Boolean)
                        .join(" · "),
                };
              })}
            />
          </Field>
          {needsReason ? (
            <Field
              label={t("reason")}
              hint={t("reasonHint", {
                threshold: formatTHB(round.threshold, locale),
                count: round.quotations.length,
                minimum: round.minimumQuotations,
              })}
              required
              error={errors.fewerQuotationsReason}
            >
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={REASON_MAX}
                data-testid="award-reason"
              />
            </Field>
          ) : null}
          <Field label={t("outcome")}>
            <SegmentedControl
              label={t("outcome")}
              value={outcome}
              onValueChange={(value) => setOutcome(value as Schemas["AwardOutcome"])}
              options={[
                { value: "contract", label: t("outcomeContract") },
                { value: "expense", label: t("outcomeExpense") },
              ]}
            />
          </Field>
          {outcome === "contract" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("startsOn")} required error={errors.startsOn}>
                <DateField name="startsOn" min={today} />
              </Field>
              <Field label={t("endsOn")} required error={errors.endsOn}>
                <DateField name="endsOn" min={today} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("account")} required error={errors.accountId}>
                <NativeSelect
                  name="accountId"
                  defaultValue=""
                  placeholder={t("accountPlaceholder")}
                  options={accounts}
                  data-testid="award-account"
                />
              </Field>
              <Field label={t("wht")}>
                <NativeSelect
                  name="whtKey"
                  defaultValue=""
                  placeholder={t("noWht")}
                  options={rates.map((rate) => ({
                    value: rate.key,
                    label: rate.verified
                      ? whtRateLabel(rate, locale)
                      : t("rateUnverified", { rate: whtRateLabel(rate, locale) }),
                  }))}
                />
              </Field>
            </div>
          )}
          <Field label={t("basis")}>
            <SegmentedControl
              label={t("basis")}
              value={basis}
              onValueChange={(value) => setBasis(value as Schemas["AwardBasis"])}
              options={[
                { value: "approval", label: t("basisApproval") },
                { value: "resolution", label: t("basisResolution") },
              ]}
            />
          </Field>
          {basis === "resolution" ? (
            <Field
              label={t("resolution")}
              hint={resolutions.length ? t("resolutionHint") : t("noResolutions")}
              required
              error={errors.resolutionId}
            >
              <NativeSelect
                name="resolutionId"
                defaultValue=""
                placeholder={t("resolutionPlaceholder")}
                options={resolutions.map((resolution) => ({ value: resolution.id, label: resolution.label }))}
                data-testid="award-resolution"
              />
            </Field>
          ) : (
            <p className="bg-bg-subtle rounded-control m-0 flex flex-col gap-1 p-3 text-sm" data-testid="award-band">
              <span>{chosen ? (bandText[chosen.id] ?? t("bandUnknown")) : t("bandUnknown")}</span>
              <span className="text-muted">{t("makerChecker")}</span>
            </p>
          )}
        </>
      )}
    </FormDialog>
  );
}

/** One approval of the award by a member of the band (never the one who asked for it). */
export function ApproveRoundButton({ round }: { round: Round }) {
  const t = useTranslations("owner.vendors.roundAction");
  const locale = useLocale() as Locale;
  const [note, setNote] = useState("");
  const awarded = round.quotations.find((quote) => quote.id === round.awardedQuotationId);
  return (
    <ConfirmAction
      label={t("approve")}
      icon={IconCheckCircle}
      block
      testId="round-approve"
      title={t("approveTitle", { title: round.title })}
      description={t("approveBody", {
        vendor: awarded?.vendorName ?? "",
        amount: awarded ? formatTHB(awarded.amount, locale) : "",
      })}
      confirmLabel={t("approve")}
      successMessage={t("approved")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/quotation-rounds/{roundId}/actions/approve", {
            params: { path: { roundId: round.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: note.trim() ? { reason: note.trim() } : {},
          }),
        )
      }
    >
      <Field label={t("approveNote")} hint={t("approveNoteHint")}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} />
      </Field>
    </ConfirmAction>
  );
}

/** Reject (the round reopens for another choice) or cancel (the round ends), each with a reason. */
export function ReasonRoundButton({ round, action }: { round: Round; action: "reject" | "cancel" }) {
  const t = useTranslations("owner.vendors.roundAction");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t(action)}
      icon={IconXCircle}
      variant={action === "reject" ? "secondary" : "destructive"}
      tone="destructive"
      block
      testId={`round-${action}`}
      title={t(`${action}Title`, { title: round.title })}
      description={t(`${action}Body`)}
      confirmLabel={t(action)}
      ready={reason.trim().length >= 3}
      successMessage={t(`${action}Done`)}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST(
            action === "reject"
              ? "/v1/owner/juristic/quotation-rounds/{roundId}/actions/reject"
              : "/v1/owner/juristic/quotation-rounds/{roundId}/actions/cancel",
            {
              params: { path: { roundId: round.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: { reason: reason.trim() },
            },
          ),
        )
      }
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={600}
          data-testid={`round-${action}-reason`}
        />
      </Field>
    </ConfirmAction>
  );
}
