"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Combobox } from "@/ui/components/Combobox";
import { ErrorSummary } from "@/ui/components/ErrorSummary";
import { FieldError } from "@/ui/components/FieldError";
import { Field } from "@/ui/components/Field";
import { FormColumns, FormSection, MobileActionBar } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { StatusText } from "@/ui/components/StatusText";
import { Switch } from "@/ui/components/Switch";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { cn } from "@/ui/lib/cn";

import { ownerPath } from "../../shared/links";
import { accountLabel } from "./accounts";
import { checkJournal, emptyJournalLine, journalLinesForApi, type JournalDraftLine } from "./journal";

type Row = JournalDraftLine & { key: string };

/**
 * A manual journal (J2.1 §2: opening balances, WHT remittance, corrections) as a numbered form. The summary beside it
 * adds up the debits and credits **the office typed** — the one place the console sums money, because the figures are
 * its own input, not the API's — and the save stays disabled, with the reason, until the journal balances over two
 * lines or more. The API checks again (and the database at commit).
 */
export function JournalForm({
  buildings,
  accounts,
  resolutions,
  defaultBuildingId,
  today,
}: {
  buildings: { id: string; name: string }[];
  accounts: Schemas["AccountDto"][];
  resolutions: { id: string; buildingId: string; label: string }[];
  defaultBuildingId?: string;
  today: string;
}) {
  const t = useTranslations("owner.accounting.journalForm");
  const locale = useLocale() as Locale;
  const counter = useRef(2);
  const [buildingId, setBuildingId] = useState(defaultBuildingId ?? buildings[0]?.id ?? "");
  const [postedOn, setPostedOn] = useState<string | null>(today);
  const [memo, setMemo] = useState("");
  const [opening, setOpening] = useState(false);
  const [resolutionId, setResolutionId] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { ...emptyJournalLine(), key: "l1" },
    { ...emptyJournalLine(), key: "l2" },
  ]);
  const [attempt, setAttempt] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const action = useApiAction<Schemas["JournalDto"]>({ refresh: false });
  const idempotency = useIdempotencyKey();

  const check = useMemo(() => checkJournal(rows), [rows]);
  const fundBankIds = useMemo(
    () => new Set(accounts.filter((account) => account.role === "fund_bank").map((account) => account.id)),
    [accounts],
  );
  const creditsFund = rows.some((row) => fundBankIds.has(row.accountId) && row.credit.trim() !== "");
  const buildingResolutions = resolutions.filter((resolution) => resolution.buildingId === buildingId);
  const options = accounts.map((account) => ({
    value: account.id,
    label: accountLabel(account, locale),
    description: account.role === "fund_bank" ? t("fundBankNote") : undefined,
  }));
  const money = (value: string) => formatTHB(value, locale);

  const set = (key: string, patch: Partial<Row>) =>
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () => {
    counter.current += 1;
    setRows((all) => [...all, { ...emptyJournalLine(), key: `l${counter.current}` }]);
  };
  const remove = (key: string) => setRows((all) => (all.length > 2 ? all.filter((row) => row.key !== key) : all));

  const blocked = !check.ok
    ? check.problems.includes("lineErrors")
      ? t("blocked.lineErrors")
      : check.problems.includes("lines")
        ? t("blocked.lines")
        : t("blocked.unbalanced", { amount: money(check.difference.replace(/^-/, "")) })
    : null;

  const submit = () => {
    const found: Record<string, string> = {};
    if (!buildingId) found["journal-building"] = t("error.building");
    if (!postedOn) found["journal-date"] = t("error.date");
    if (!memo.trim()) found["journal-memo"] = t("error.memo");
    if (creditsFund && !resolutionId) found["journal-resolution"] = t("error.resolution");
    check.lineErrors.forEach((error, index) => {
      if (error) found[`journal-line-${rows[index]!.key}`] = t(`lineError.${error}`, { n: index + 1 });
    });
    setLocal(found);
    setAttempt((n) => n + 1);
    if (Object.keys(found).length || !check.ok) return;
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/journals", {
            params: { header: { "Idempotency-Key": idempotency.key } },
            body: {
              buildingId,
              postedOn: postedOn!,
              memo: memo.trim(),
              lines: journalLinesForApi(rows),
              ...(opening ? { opening: true } : {}),
              ...(resolutionId ? { resolutionId } : {}),
            },
          }),
        ),
      (journal) => window.location.assign(ownerPath(locale, `/juristic/accounting/journals/${journal.id}`)),
    );
  };

  const save = (
    <Button onClick={submit} loading={action.busy} disabled={!check.ok} data-testid="journal-save">
      {t("save")}
    </Button>
  );

  const summary = (
    <section
      className="rounded-card border-border bg-surface shadow-card flex flex-col border"
      aria-labelledby="journal-summary-title"
      data-testid="journal-summary"
      data-balanced={check.balanced}
    >
      <h2 id="journal-summary-title" className="px-5 pt-5 text-base font-semibold">
        {t("summary.title")}
      </h2>
      <dl className="flex flex-col gap-2 px-5 pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">{t("summary.debit")}</dt>
          <dd className="tabular-nums" data-testid="journal-sum-debit">
            {money(check.debit)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">{t("summary.credit")}</dt>
          <dd className="tabular-nums" data-testid="journal-sum-credit">
            {money(check.credit)}
          </dd>
        </div>
        <div className="border-border flex items-baseline justify-between gap-4 border-t pt-2">
          <dt className="font-medium">{t("summary.difference")}</dt>
          <dd className="font-semibold tabular-nums" data-testid="journal-difference">
            {money(check.difference)}
          </dd>
        </div>
      </dl>
      <div className="px-5 pt-4" aria-live="polite">
        {check.ok ? (
          <StatusText tone="success" icon={IconCheckCircle} testId="journal-balance-state" state="balanced">
            {t("summary.balanced")}
          </StatusText>
        ) : (
          <StatusText tone="warning" icon={IconWarning} testId="journal-balance-state" state="unbalanced">
            {blocked}
          </StatusText>
        )}
      </div>
      <div className="hidden p-5 md:block [&>*]:w-full">{save}</div>
      <p className="text-muted border-border border-t px-5 py-3 text-xs">{t("summary.note")}</p>
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <ErrorSummary
        title={t("errorTitle", { count: Object.keys(local).length })}
        items={Object.entries(local).map(([fieldId, message]) => ({ fieldId, message }))}
        focusKey={attempt}
        testId="journal-errors"
      />
      <FormColumns summary={summary}>
        <FormSection number={1} title={t("section.when")} description={t("section.whenHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required error={local["journal-building"]}>
              <NativeSelect
                id="journal-building"
                value={buildingId}
                onChange={(event) => setBuildingId(event.target.value)}
                options={buildings.map((building) => ({ value: building.id, label: building.name }))}
                data-testid="journal-building"
              />
            </Field>
            <Field label={t("postedOn")} hint={t("postedOnHint")} required error={local["journal-date"]}>
              <DateField name="postedOn" defaultValue={today} max={today} onChange={setPostedOn} />
            </Field>
          </div>
          <Switch label={t("opening")} description={t("openingHint")} checked={opening} onCheckedChange={setOpening} />
        </FormSection>

        <FormSection number={2} title={t("section.lines")} description={t("section.linesHint")}>
          <div className="flex flex-col gap-3" data-testid="journal-lines-form">
            <div className="text-muted hidden grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_2.75rem] gap-3 text-sm font-medium md:grid">
              <span>{t("account")}</span>
              <span className="text-end">{t("debit")}</span>
              <span className="text-end">{t("credit")}</span>
              <span />
            </div>
            {rows.map((row, index) => {
              const error = check.lineErrors[index];
              return (
                <div
                  key={row.key}
                  id={`journal-line-${row.key}`}
                  tabIndex={-1}
                  className={cn(
                    "border-border flex flex-col gap-2 border-b pb-3 last:border-b-0 md:border-0 md:pb-0",
                    error && attempt > 0 && "rounded-control",
                  )}
                  data-testid="journal-line-input"
                >
                  <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_2.75rem]">
                    <div className="col-span-2 md:col-span-1">
                      <Field label={t("account")} labelHidden>
                        <Combobox
                          options={options}
                          value={row.accountId || null}
                          onChange={(value) => set(row.key, { accountId: value ?? "" })}
                          placeholder={t("accountPlaceholder")}
                          emptyLabel={t("noAccount")}
                          listLabel={t("account")}
                        />
                      </Field>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-muted text-sm md:sr-only">{t("debitOf", { n: index + 1 })}</span>
                      <Input
                        value={row.debit}
                        onChange={(event) => set(row.key, { debit: event.target.value })}
                        inputMode="decimal"
                        className="text-end tabular-nums"
                        data-testid="journal-line-debit"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-muted text-sm md:sr-only">{t("creditOf", { n: index + 1 })}</span>
                      <Input
                        value={row.credit}
                        onChange={(event) => set(row.key, { credit: event.target.value })}
                        inputMode="decimal"
                        className="text-end tabular-nums"
                        data-testid="journal-line-credit"
                      />
                    </label>
                    <Button
                      variant="ghost"
                      iconStart={IconDelete}
                      onClick={() => remove(row.key)}
                      disabled={rows.length <= 2}
                      aria-label={t("removeLine", { n: index + 1 })}
                      className="col-span-2 justify-self-end md:col-span-1"
                    >
                      <span className="sr-only">{t("removeLine", { n: index + 1 })}</span>
                    </Button>
                  </div>
                  <Input
                    value={row.memo ?? ""}
                    onChange={(event) => set(row.key, { memo: event.target.value })}
                    maxLength={500}
                    placeholder={t("lineMemo")}
                    aria-label={t("lineMemoOf", { n: index + 1 })}
                    inputSize="sm"
                  />
                  {error && (attempt > 0 || error === "both") ? (
                    <FieldError alert>{t(`lineError.${error}`, { n: index + 1 })}</FieldError>
                  ) : null}
                </div>
              );
            })}
            <div>
              <Button variant="secondary" size="sm" iconStart={IconAdd} onClick={add} data-testid="journal-add-line">
                {t("addLine")}
              </Button>
            </div>
          </div>
        </FormSection>

        <FormSection number={3} title={t("section.memo")} description={t("section.memoHint")}>
          <Field label={t("memo")} required error={local["journal-memo"]}>
            <Textarea
              id="journal-memo"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={2}
              maxLength={500}
              data-testid="journal-memo"
            />
          </Field>
          {creditsFund ? (
            <Field
              label={t("resolution")}
              hint={buildingResolutions.length ? t("resolutionHint") : t("noResolutions")}
              required
              error={local["journal-resolution"]}
            >
              <NativeSelect
                id="journal-resolution"
                value={resolutionId}
                onChange={(event) => setResolutionId(event.target.value)}
                placeholder={t("resolutionPlaceholder")}
                options={buildingResolutions.map((resolution) => ({ value: resolution.id, label: resolution.label }))}
                data-testid="journal-resolution"
              />
            </Field>
          ) : null}
        </FormSection>
        <ProblemNotice error={action.error} />
      </FormColumns>
      <MobileActionBar summary={check.ok ? t("summary.balanced") : (blocked ?? undefined)}>{save}</MobileActionBar>
    </div>
  );
}
