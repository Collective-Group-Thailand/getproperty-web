"use client";

import { useLocale, useTranslations } from "next-intl";
import { useReducer, useRef, useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Combobox } from "@/ui/components/Combobox";
import { ErrorSummary, type ErrorSummaryItem } from "@/ui/components/ErrorSummary";
import { Field } from "@/ui/components/Field";
import { FormColumns, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { StatusText } from "@/ui/components/StatusText";
import { WizardSections } from "@/ui/components/WizardSections";
import { Icon } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconForward } from "@/ui/icons/glyphs/forward";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import type { PartyOption } from "./RegisterActions";
import { checkShares, formatShare, shareString } from "./shares";
import {
  checkTransfer,
  initialTransfer,
  stepComplete,
  TRANSFER_STEPS,
  transferBody,
  transferReducer,
  type BuyerDraft,
} from "./transferWizard";

type Register = Schemas["RegisterUnitDetailDto"];

/**
 * The whole-unit transfer (J1.1b, D-307) as a three-step page: the date the buyers own the unit from, the buyers and
 * their shares, then a review that restates the unit, the sellers, the date and the shares and asks for the unit
 * number before the API records it (`Idempotency-Key`, one per page). The API closes every current owner, opens the
 * buyers and settles issued advance invoices by its policy; the page shows that answer — credit notes to the sellers
 * and charges to the buyers — and never computes a proration itself.
 */
export function TransferWizard({
  unit,
  unitWord,
  parties,
  registerHref,
}: {
  unit: Register;
  /** "ห้อง" / "บ้าน" — the property kind's word for a unit. */
  unitWord: string;
  parties: PartyOption[];
  registerHref: string;
}) {
  const t = useTranslations("owner.juristic.transfer");
  const locale = useLocale() as Locale;
  const [state, dispatch] = useReducer(transferReducer, undefined, () => initialTransfer());
  const [attempt, setAttempt] = useState(0);
  const [phrase, setPhrase] = useState("");
  const [result, setResult] = useState<Schemas["TransferResultDto"] | null>(null);
  const action = useApiAction<Schemas["TransferResultDto"]>({ refresh: false });
  const idempotency = useIdempotencyKey();
  const nextKey = useRef(2);
  const check = checkTransfer(state);
  const index = TRANSFER_STEPS.indexOf(state.step);
  const sellers = unit.owners;

  const errors: ErrorSummaryItem[] = [];
  if (state.showErrors && state.step === "date" && check.date)
    errors.push({ fieldId: "transfer-date", message: t(`error.date.${check.date}`) });
  if (state.showErrors && state.step === "buyers") {
    state.buyers.forEach((buyer, position) => {
      for (const error of check.buyers[buyer.key] ?? [])
        errors.push({
          fieldId:
            error === "party" ? `${buyer.key}-party` : error === "name" ? `${buyer.key}-name` : `${buyer.key}-share`,
          message: t(`error.buyer.${error}`, { n: position + 1 }),
        });
    });
    const first = state.buyers[0]?.key ?? "buyer-1";
    if (check.shares.state === "over") errors.push({ fieldId: `${first}-share`, message: t("error.sharesOver") });
    if (check.duplicate) errors.push({ fieldId: `${first}-party`, message: t("error.duplicate") });
  }

  const next = () => {
    if (!stepComplete(state)) setAttempt((n) => n + 1);
    dispatch({ type: "next" });
  };

  const buyerName = (buyer: BuyerDraft) =>
    buyer.source === "existing"
      ? (parties.find((party) => party.id === buyer.partyId)?.name ?? "—")
      : buyer.displayName.trim() || "—";

  const submit = () => {
    if (!stepComplete(state, "review") || phrase.trim() !== unit.unitNo) return;
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/register/units/{unitId}/transfers", {
            params: { path: { unitId: unit.unitId }, header: { "Idempotency-Key": idempotency.key } },
            body: transferBody(state),
          }),
        ),
      (answer) => setResult(answer),
    );
  };

  if (result)
    return <TransferResult result={result} unitWord={unitWord} unitNo={unit.unitNo} registerHref={registerHref} />;

  const summary = (
    <FormSummary
      title={t("summary.title")}
      rows={[
        { key: "unit", label: unitWord, value: <span className="font-mono">{unit.unitNo}</span> },
        {
          key: "sellers",
          label: <span className="whitespace-nowrap">{t("summary.sellers")}</span>,
          value: (
            <span className="flex flex-col items-end">
              {sellers.map((owner) => (
                <span key={owner.ownershipId}>
                  {owner.party.displayName} · {formatShare(owner.sharePct)}%
                </span>
              ))}
            </span>
          ),
        },
        {
          key: "date",
          label: t("summary.date"),
          value: check.date === null ? formatDate(state.transferDate, locale) : "—",
        },
        ...state.buyers.map((buyer, position) => ({
          key: buyer.key,
          label: <span className="whitespace-nowrap">{t("summary.buyer", { n: position + 1 })}</span>,
          value: `${buyerName(buyer) === "—" ? t("summary.unnamed") : buyerName(buyer)}${buyer.share.trim() ? ` · ${buyer.share.trim().replace(/%$/, "")}%` : ""}`,
        })),
      ]}
      total={{
        label: t("summary.shares"),
        value: (
          <span data-testid="transfer-total" data-state={check.shares.state}>
            {shareString(check.shares.total)}%
          </span>
        ),
      }}
      note={t("summary.note")}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: errors.length })}
        items={errors}
        focusKey={attempt}
        testId="transfer-errors"
      />
      <FormColumns summary={summary}>
        <WizardSections
          testId="transfer-wizard"
          current={index}
          steps={[
            {
              key: "date",
              label: t("step.date"),
              summary: check.date === null ? formatDate(state.transferDate, locale) : undefined,
              edit: (
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "goto", step: "date" })}>
                  {t("edit")}
                </Button>
              ),
            },
            {
              key: "buyers",
              label: t("step.buyers"),
              summary: state.buyers.map((buyer) => `${buyerName(buyer)} ${buyer.share.trim()}%`).join(", "),
              edit: (
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "goto", step: "buyers" })}>
                  {t("edit")}
                </Button>
              ),
            },
            { key: "review", label: t("step.review") },
          ]}
        >
          {state.step === "date" ? (
            <>
              <p className="text-muted m-0 text-sm">{t("dateHint", { unit: unitWord })}</p>
              <Field
                label={t("date")}
                required
                error={state.showErrors && check.date ? t(`error.date.${check.date}`) : undefined}
              >
                <div id="transfer-date" tabIndex={-1} className="max-w-64" data-testid="transfer-date">
                  <DateField
                    name="transferDate"
                    defaultValue={state.transferDate || null}
                    onChange={(value) => dispatch({ type: "date", value: value ?? "" })}
                  />
                </div>
              </Field>
              <div className="flex justify-end">
                <Button iconEnd={IconForward} onClick={next} data-testid="transfer-next">
                  {t("next")}
                </Button>
              </div>
            </>
          ) : null}

          {state.step === "buyers" ? (
            <>
              <p className="text-muted m-0 text-sm">{t("buyersHint")}</p>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {state.buyers.map((buyer, position) => (
                  <BuyerRow
                    key={buyer.key}
                    buyer={buyer}
                    n={position + 1}
                    parties={parties.filter(
                      (party) => !state.buyers.some((other) => other.key !== buyer.key && other.partyId === party.id),
                    )}
                    errors={state.showErrors ? (check.buyers[buyer.key] ?? []) : []}
                    over={state.showErrors && check.shares.state === "over"}
                    removable={state.buyers.length > 1}
                    onChange={(patch) => dispatch({ type: "buyer", key: buyer.key, patch })}
                    onRemove={() => dispatch({ type: "removeBuyer", key: buyer.key })}
                  />
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart={IconAdd}
                  onClick={() => {
                    dispatch({ type: "addBuyer", key: `buyer-${nextKey.current}` });
                    nextKey.current += 1;
                  }}
                  data-testid="transfer-add-buyer"
                >
                  {t("addBuyer")}
                </Button>
                {state.buyers.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "splitEvenly" })}>
                    {t("splitEvenly")}
                  </Button>
                ) : null}
                <span className="ms-auto" aria-live="polite">
                  <StatusText
                    tone={
                      check.shares.state === "over" ? "danger" : check.shares.state === "under" ? "warning" : "success"
                    }
                    icon={check.shares.state === "complete" ? IconCheckCircle : IconWarning}
                    testId="transfer-shares-state"
                    state={check.shares.state}
                  >
                    {check.shares.state === "complete"
                      ? t("shares.complete")
                      : check.shares.state === "under"
                        ? t("shares.under", { value: shareString(check.shares.remaining) })
                        : t("shares.over")}
                  </StatusText>
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" iconStart={IconBack} onClick={() => dispatch({ type: "back" })}>
                  {t("back")}
                </Button>
                <Button iconEnd={IconForward} onClick={next} data-testid="transfer-next">
                  {t("next")}
                </Button>
              </div>
            </>
          ) : null}

          {state.step === "review" ? (
            <>
              <dl
                className="border-border m-0 grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-2"
                data-testid="transfer-review"
              >
                <div className="flex flex-col gap-1">
                  <dt className="text-muted">{t("review.from")}</dt>
                  <dd className="m-0">
                    {sellers.map((owner) => (
                      <span key={owner.ownershipId} className="block">
                        {owner.party.displayName} · {formatShare(owner.sharePct)}%
                      </span>
                    ))}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted">{t("review.to")}</dt>
                  <dd className="m-0">
                    {state.buyers.map((buyer) => (
                      <span key={buyer.key} className="block">
                        {buyerName(buyer)} · {buyer.share.trim().replace(/%$/, "")}%
                      </span>
                    ))}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted">{t("review.date")}</dt>
                  <dd className="m-0">{formatDate(state.transferDate, locale, { style: "long" })}</dd>
                </div>
              </dl>
              {check.shares.state === "under" ? (
                <Callout tone="warning" title={t("review.underTitle")}>
                  {t("review.underBody", { value: shareString(check.shares.remaining) })}
                </Callout>
              ) : null}
              <Field label={t("policy.label")} hint={t("policy.hint")}>
                <RadioCards
                  columns={1}
                  value={state.policy || "default"}
                  onValueChange={(value) =>
                    dispatch({
                      type: "policy",
                      value: value === "default" ? "" : (value as Schemas["TransferProration"]),
                    })
                  }
                  options={[
                    { value: "default", label: t("policy.default"), description: t("policy.defaultHint") },
                    { value: "carry_to_buyer", label: t("policy.carry_to_buyer"), description: t("policy.carryHint") },
                    { value: "refund_seller", label: t("policy.refund_seller"), description: t("policy.refundHint") },
                  ]}
                />
              </Field>
              <Field label={t("note")} hint={t("noteHint")}>
                <Textarea
                  value={state.note}
                  onChange={(event) => dispatch({ type: "note", value: event.target.value })}
                  rows={2}
                  maxLength={1000}
                />
              </Field>
              <Field label={t("confirm", { unit: unit.unitNo })} hint={t("confirmHint", { unit: unitWord })} required>
                <Input
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                  autoComplete="off"
                  className="max-w-56 font-mono"
                  data-testid="transfer-confirm"
                />
              </Field>
              <ProblemNotice error={action.error} />
              <div className="flex justify-between gap-2">
                <Button variant="ghost" iconStart={IconBack} onClick={() => dispatch({ type: "back" })}>
                  {t("back")}
                </Button>
                <Button
                  onClick={submit}
                  loading={action.busy}
                  disabled={phrase.trim() !== unit.unitNo}
                  data-testid="transfer-submit"
                >
                  {t("submit")}
                </Button>
              </div>
            </>
          ) : null}
        </WizardSections>
      </FormColumns>
      <MobileActionBar summary={t("summary.mobile", { value: shareString(check.shares.total) })}>
        {state.step === "review" ? (
          <Button onClick={submit} loading={action.busy} disabled={phrase.trim() !== unit.unitNo} block>
            {t("submit")}
          </Button>
        ) : (
          <Button onClick={next} block>
            {t("next")}
          </Button>
        )}
      </MobileActionBar>
    </div>
  );
}

function BuyerRow({
  buyer,
  n,
  parties,
  errors,
  over,
  removable,
  onChange,
  onRemove,
}: {
  buyer: BuyerDraft;
  n: number;
  parties: PartyOption[];
  errors: string[];
  /** The buyers' shares pass 100 % (shown on every share after a failed "next"). */
  over: boolean;
  removable: boolean;
  onChange: (patch: Partial<Omit<BuyerDraft, "key">>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("owner.juristic.transfer");
  const party = useTranslations("owner.juristic.party");
  const has = (error: string) => errors.includes(error);
  return (
    <li className="rounded-card border-border flex flex-col gap-4 border p-4" data-testid="transfer-buyer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-base font-semibold">{t("buyer", { n })}</h3>
        {removable ? (
          <Button variant="ghost" size="sm" iconStart={IconRemove} onClick={onRemove}>
            {t("removeBuyer")}
          </Button>
        ) : null}
      </div>
      {parties.length ? (
        <SegmentedControl
          label={t("buyerSource", { n })}
          value={buyer.source}
          onValueChange={(value) => onChange({ source: value as BuyerDraft["source"] })}
          options={[
            { value: "new", label: party("new") },
            { value: "existing", label: party("existing") },
          ]}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {buyer.source === "existing" ? (
          <Field label={party("pick")} required error={has("party") ? t("error.buyer.party", { n }) : undefined}>
            <div id={`${buyer.key}-party`} tabIndex={-1}>
              <Combobox
                options={parties.map((option) => ({
                  value: option.id,
                  label: option.name,
                  description: party(`type.${option.type}`),
                }))}
                value={buyer.partyId || null}
                onChange={(value) => onChange({ partyId: value ?? "" })}
                placeholder={party("searchPlaceholder")}
                emptyLabel={party("noMatch")}
                listLabel={party("pick")}
              />
            </div>
          </Field>
        ) : (
          <>
            <Field label={party("name")} required error={has("name") ? t("error.buyer.name", { n }) : undefined}>
              <Input
                id={`${buyer.key}-name`}
                value={buyer.displayName}
                onChange={(event) => onChange({ displayName: event.target.value })}
                autoComplete="off"
                data-testid="buyer-name"
              />
            </Field>
            <Field label={party("typeLabel")}>
              <NativeSelect
                value={buyer.type}
                onChange={(event) => onChange({ type: event.target.value as Schemas["PartyType"] })}
                options={(["person", "company"] as const).map((value) => ({ value, label: party(`type.${value}`) }))}
              />
            </Field>
            <Field label={party("phone")} hint={party("phoneHint")}>
              <Input
                type="tel"
                inputMode="tel"
                value={buyer.phone}
                onChange={(event) => onChange({ phone: event.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field label={party("email")}>
              <Input
                type="email"
                value={buyer.email}
                onChange={(event) => onChange({ email: event.target.value })}
                autoComplete="off"
              />
            </Field>
          </>
        )}
        <Field
          label={t("share")}
          hint={t("shareHint")}
          required
          error={
            has("share")
              ? t("error.buyer.share", { n })
              : has("shareZero")
                ? t("error.buyer.shareZero", { n })
                : over
                  ? t("error.sharesOver")
                  : undefined
          }
        >
          <Input
            id={`${buyer.key}-share`}
            value={buyer.share}
            onChange={(event) => onChange({ share: event.target.value })}
            inputMode="decimal"
            className="max-w-40"
            data-testid="buyer-share"
          />
        </Field>
      </div>
    </li>
  );
}

/** The API's answer: who owns the unit now and what it did with the period already billed in advance. */
function TransferResult({
  result,
  unitWord,
  unitNo,
  registerHref,
}: {
  result: Schemas["TransferResultDto"];
  unitWord: string;
  unitNo: string;
  registerHref: string;
}) {
  const t = useTranslations("owner.juristic.transfer");
  const locale = useLocale() as Locale;
  const { transfer, register } = result;
  // The buyers' rows (they start on the transfer date, which may still be ahead: "owners today" are then the sellers).
  const buyers = register.history.filter((row) => transfer.toOwnershipIds.includes(row.ownershipId));
  return (
    <section
      aria-labelledby="transfer-done"
      className="rounded-card border-border bg-surface shadow-card mx-auto flex w-full max-w-2xl flex-col gap-5 border p-6 md:p-8"
      data-testid="transfer-result"
    >
      <div className="flex items-start gap-3">
        <span className="bg-success-subtle text-success-subtle-fg grid size-10 shrink-0 place-items-center rounded-full">
          <Icon icon={IconCheckCircle} size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="transfer-done" className="text-xl font-semibold">
            {t("done.title", { unit: unitWord, no: unitNo })}
          </h2>
          <p className="text-muted m-0">
            {t("done.lede", { date: formatDate(transfer.transferDate, locale, { style: "long" }) })}
          </p>
        </div>
      </div>
      <dl className="border-border m-0 grid gap-3 border-y py-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted">{t("done.owners")}</dt>
          <dd className="m-0 text-end">
            {buyers.map((owner) => (
              <span key={owner.ownershipId} className="block">
                {owner.party.displayName} · {formatShare(owner.sharePct)}%
              </span>
            ))}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted">{t("done.policy")}</dt>
          <dd className="m-0">{t(`policy.${transfer.policy}`)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2" data-testid="transfer-credit-notes">
          <dt className="text-muted">{t("done.credits")}</dt>
          <dd className="m-0">
            {transfer.creditNoteIds.length
              ? t("creditNotes", { count: transfer.creditNoteIds.length })
              : t("done.noCredits")}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2" data-testid="transfer-charges">
          <dt className="text-muted">{t("done.charges")}</dt>
          <dd className="m-0">
            {transfer.chargeIds.length ? t("charges", { count: transfer.chargeIds.length }) : t("done.noCharges")}
          </dd>
        </div>
      </dl>
      {checkShares(buyers.map((row) => row.sharePct)).state === "under" ? (
        <Callout tone="warning" title={t("review.underTitle")}>
          {t("done.incomplete")}
        </Callout>
      ) : null}
      <p className="text-muted m-0 text-sm">{t("done.next")}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild>
          <a href={registerHref} data-testid="transfer-open-unit">
            {t("done.open", { unit: unitWord })}
          </a>
        </Button>
      </div>
    </section>
  );
}
