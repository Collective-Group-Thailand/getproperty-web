"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { problemError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { BulkBar } from "@/ui/components/BulkBar";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
import { IconChevronUp } from "@/ui/icons/glyphs/chevron-up";
import { IconChevronsUpDown } from "@/ui/icons/glyphs/chevrons-up-down";
import { IconPause } from "@/ui/icons/glyphs/pause";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";
import { cn } from "@/ui/lib/cn";

import { BULK_SKIP, keyedSend, runBulk, type BulkOutcome } from "./bulk";
import { ChannelIcons, NextStepBadgeView } from "./parts";
import { contextParts } from "./receivables";

export type ReceivableRow = Schemas["ReceivableRowDto"] & { href: string | null };
type SortCell = { href: string; aria: "ascending" | "descending" | "none" };

/**
 * The receivables table (J-DESIGN §3): a checkbox column for bulk work, the unit pinned as a mono link, the owner with
 * the muted context line, outstanding and surcharge right-aligned in tabular Anuphan, the oldest overdue, the next
 * ladder step as a badge with its icon, the channels as icons. The whole row opens the case. Phones: one card per row.
 * Bulk actions run one request per row through the API (remind, propose a plan, pause with a dispute); what each row
 * did is reported under the bar.
 */
export function ReceivablesTable({
  rows,
  canManage,
  maxInstalments,
  sort,
}: {
  rows: ReceivableRow[];
  canManage: boolean;
  /** `juristic.plan_max_instalments` from the API's settings (null when not readable). */
  maxInstalments: number | null;
  sort: { amount: SortCell; age: SortCell };
}) {
  const t = useTranslations("owner.collections.receivables");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<{ action: string; result: BulkOutcome<ReceivableRow> } | null>(null);
  const key = (row: ReceivableRow) => `${row.partyId}:${row.unitId}`;
  // One Idempotency-Key per action × row (× what is sent) until the API answers it (review W5).
  const keys = useRef(new Map<string, string>());
  const chosen = rows.filter((row) => selected.has(key(row)));
  const allChosen = rows.length > 0 && chosen.length === rows.length;
  const toggle = (row: ReceivableRow, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key(row));
      else next.delete(key(row));
      return next;
    });
  const clear = () => setSelected(new Set());
  const finish = (action: string) => (result: unknown) => {
    setOutcome({ action, result: result as BulkOutcome<ReceivableRow> });
    clear();
  };

  const open = (row: ReceivableRow) => (event: React.MouseEvent) => {
    if (!row.href) return;
    if ((event.target as HTMLElement).closest("a, button, input, label, [role=checkbox]")) return;
    router.push(row.href);
  };

  const remind = (row: ReceivableRow) =>
    unwrap(
      browserApi().GET("/v1/owner/invoices", {
        params: {
          query: {
            unitId: row.unitId,
            partyId: row.partyId,
            status: "overdue",
            sort: "dueDate",
            order: "asc",
            perPage: 1,
          },
        },
      }),
    ).then((page) => {
      const invoice = page.data[0];
      if (!invoice) throw problemError(409, { code: "invoice.nothing_due", detail: t("bulk.noInvoice") });
      return keyedSend(keys.current, `remind:${key(row)}:${invoice.id}`, (idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/send-reminder", {
            params: { path: { invoiceId: invoice.id }, header: { "Idempotency-Key": idempotencyKey } },
          }),
        ),
      );
    });

  const willRemind = chosen.filter((row) => !BULK_SKIP.remind(row)).length;
  const willPlan = chosen.filter((row) => !BULK_SKIP.plan(row)).length;
  const willPause = chosen.filter((row) => !BULK_SKIP.dispute(row)).length;
  const [reason, setReason] = useState("");

  const sortHeader = (column: "amount" | "age", label: string) => (
    <a
      href={sort[column].href}
      className="hover:text-fg inline-flex items-center gap-1 underline-offset-4"
      data-testid={`receivables-sort-${column}`}
    >
      {label}
      <Icon
        icon={
          sort[column].aria === "ascending"
            ? IconChevronUp
            : sort[column].aria === "descending"
              ? IconChevronDown
              : IconChevronsUpDown
        }
        size={14}
      />
    </a>
  );

  const owner = (row: ReceivableRow) => {
    const parts = contextParts(row.context);
    return (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{row.ownerName}</span>
        {parts.length ? (
          <span className="text-muted truncate text-sm" data-testid="receivable-context">
            {parts.map((part) => t(`context.${part.key}`, { count: part.count ?? 0 })).join(" · ")}
          </span>
        ) : null}
      </span>
    );
  };
  const overdue = (row: ReceivableRow) =>
    row.oldestOverdueOn ? (
      <span className="flex flex-col">
        <span className="tabular-nums">{t("months", { count: row.oldestOverdueMonths })}</span>
        <span className="text-muted text-sm tabular-nums">{formatDate(row.oldestOverdueOn, locale)}</span>
      </span>
    ) : (
      <span className="text-muted">{t("noneOverdue")}</span>
    );
  const money = (value: string) => formatTHB(value, locale);
  const surcharge = (value: string) =>
    /^0+(\.0+)?$/.test(value) ? <span className="text-muted">—</span> : money(value);

  return (
    <div className="flex flex-col gap-3">
      {canManage && chosen.length > 0 ? (
        <BulkBar
          label={t("bulk.label")}
          testId="receivables-bulk"
          selection={t("bulk.selected", { count: formatNumber(chosen.length, locale) })}
          actions={
            <>
              <ConfirmAction
                label={t("bulk.remind")}
                icon={IconBell}
                variant="secondary"
                size="sm"
                testId="bulk-remind"
                title={t("bulk.remindTitle", { count: willRemind })}
                description={t("bulk.remindBody", { send: willRemind, skip: chosen.length - willRemind })}
                confirmLabel={t("bulk.remindConfirm")}
                ready={willRemind > 0}
                onConfirm={() => runBulk(chosen, BULK_SKIP.remind, remind)}
                onDone={finish("remind")}
              />
              <FormDialog
                label={t("bulk.plan")}
                icon={IconRepeat}
                size="sm"
                testId="bulk-plan"
                title={t("bulk.planTitle", { count: willPlan })}
                description={t("bulk.planBody", { skip: chosen.length - willPlan })}
                submitLabel={t("bulk.planConfirm")}
                onSubmit={(data) => {
                  const count = Number(text(data, "instalments"));
                  const max = maxInstalments ?? 12;
                  if (!Number.isInteger(count) || count < 2 || count > max)
                    invalidField("instalments", t("bulk.instalmentsRange", { max }));
                  const firstDueOn = text(data, "firstDueOn");
                  const note = text(data, "note");
                  return runBulk(chosen, BULK_SKIP.plan, (row) =>
                    keyedSend(keys.current, `plan:${key(row)}:${count}:${firstDueOn}:${note}`, (idempotencyKey) =>
                      unwrap(
                        browserApi().POST("/v1/owner/juristic/payment-plans", {
                          params: { header: { "Idempotency-Key": idempotencyKey } },
                          body: {
                            partyId: row.partyId,
                            unitId: row.unitId,
                            instalments: count,
                            ...(firstDueOn ? { firstDueOn } : {}),
                            ...(note ? { note } : {}),
                          },
                        }),
                      ),
                    ),
                  );
                }}
                onDone={finish("plan")}
              >
                {(errors) => (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label={t("bulk.instalments")}
                        hint={t("bulk.instalmentsHint", { max: maxInstalments ?? 12 })}
                        required
                        error={errors.instalments}
                      >
                        <Input
                          name="instalments"
                          type="number"
                          min={2}
                          max={maxInstalments ?? 12}
                          defaultValue={6}
                          data-testid="bulk-plan-instalments"
                        />
                      </Field>
                      <Field label={t("bulk.firstDue")} hint={t("bulk.firstDueHint")} error={errors.firstDueOn}>
                        <DateField name="firstDueOn" defaultValue={null} />
                      </Field>
                    </div>
                    <Field label={t("bulk.note")} hint={t("bulk.noteHint")} error={errors.note}>
                      <Textarea name="note" rows={2} maxLength={500} />
                    </Field>
                  </>
                )}
              </FormDialog>
              <ConfirmAction
                label={t("bulk.pause")}
                icon={IconPause}
                variant="secondary"
                size="sm"
                testId="bulk-pause"
                title={t("bulk.pauseTitle", { count: willPause })}
                description={t("bulk.pauseBody", { skip: chosen.length - willPause })}
                confirmLabel={t("bulk.pauseConfirm")}
                ready={willPause > 0 && reason.trim().length >= 3}
                onConfirm={() =>
                  runBulk(chosen, BULK_SKIP.dispute, (row) =>
                    keyedSend(keys.current, `pause:${row.caseId}:${reason.trim()}`, (idempotencyKey) =>
                      unwrap(
                        browserApi().POST("/v1/owner/juristic/collection-cases/{caseId}/actions/open-dispute", {
                          params: { path: { caseId: row.caseId! }, header: { "Idempotency-Key": idempotencyKey } },
                          body: { reason: reason.trim() },
                        }),
                      ),
                    ),
                  )
                }
                onDone={(result) => {
                  setReason("");
                  finish("pause")(result);
                }}
              >
                <Field label={t("bulk.pauseReason")} hint={t("bulk.pauseReasonHint")} required>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    maxLength={500}
                    data-testid="bulk-pause-reason"
                  />
                </Field>
              </ConfirmAction>
            </>
          }
          clear={
            <Button size="sm" variant="ghost" onClick={clear} data-testid="bulk-clear">
              {t("bulk.clear")}
            </Button>
          }
        />
      ) : null}

      {outcome ? (
        <Callout
          tone={outcome.result.failed.length ? "warning" : "success"}
          title={t(`bulk.result.${outcome.action}` as "bulk.result.remind", { count: outcome.result.done.length })}
        >
          <div className="flex flex-col gap-1" data-testid="bulk-outcome">
            {outcome.result.skipped.length ? (
              <p className="m-0">
                {t("bulk.skippedLine", {
                  count: outcome.result.skipped.length,
                  units: outcome.result.skipped
                    .map(({ row, reason: why }) => `${row.unitNo} (${t(`bulk.skip.${why}`)})`)
                    .join(", "),
                })}
              </p>
            ) : null}
            {outcome.result.failed.map(({ row, message }) => (
              <p key={key(row)} className="m-0">
                {t("bulk.failedLine", { unit: row.unitNo, message: message || t("bulk.failedUnknown") })}
              </p>
            ))}
            <span>
              <Button size="sm" variant="ghost" onClick={() => setOutcome(null)}>
                {t("bulk.dismiss")}
              </Button>
            </span>
          </div>
        </Callout>
      ) : null}

      {/* Desktop and tablet: the table, the unit column pinned while it scrolls sideways. */}
      <div className="border-border bg-surface rounded-card shadow-card relative overflow-x-auto border max-md:hidden">
        <table className="w-full min-w-[60rem] text-base" data-testid="receivables-table">
          <caption className="sr-only">{t("listTitle")}</caption>
          <thead>
            <tr className="border-border text-muted border-b text-sm">
              {canManage ? (
                <th scope="col" className="bg-surface sticky start-0 z-1 w-12 px-4 py-2.5">
                  <Checkbox
                    label={<span className="sr-only">{t("bulk.selectAll")}</span>}
                    checked={allChosen ? true : chosen.length ? "indeterminate" : false}
                    onCheckedChange={(on) => setSelected(on === true ? new Set(rows.map(key)) : new Set())}
                    data-testid="receivables-select-all"
                  />
                </th>
              ) : null}
              <th
                scope="col"
                className={cn(
                  "bg-surface sticky z-1 px-4 py-2.5 text-start font-medium",
                  canManage ? "start-12" : "start-0",
                )}
              >
                {t("col.unit")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("col.owner")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium" aria-sort={sort.amount.aria}>
                {sortHeader("amount", t("col.outstanding"))}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                {t("col.surcharge")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium" aria-sort={sort.age.aria}>
                {sortHeader("age", t("col.oldest"))}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("col.next")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                {t("col.channels")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const on = selected.has(key(row));
              const pin = cn("sticky z-1", on ? "bg-primary-subtle" : "bg-surface group-hover:bg-bg-subtle");
              return (
                <tr
                  key={key(row)}
                  onClick={open(row)}
                  className={cn(
                    "group border-border border-b last:border-b-0",
                    row.href && "cursor-pointer",
                    on ? "bg-primary-subtle" : "hover:bg-bg-subtle",
                  )}
                  data-testid="receivable-row"
                  data-unit={row.unitNo}
                  data-case={row.caseId ?? ""}
                >
                  {canManage ? (
                    <td className={cn(pin, "start-0 w-12 px-4 py-3 align-top")}>
                      <Checkbox
                        label={<span className="sr-only">{t("bulk.selectRow", { unit: row.unitNo })}</span>}
                        checked={on}
                        onCheckedChange={(value) => toggle(row, value === true)}
                        data-testid="receivable-select"
                      />
                    </td>
                  ) : null}
                  <td className={cn(pin, canManage ? "start-12" : "start-0", "px-4 py-3 align-top")}>
                    {row.href ? (
                      <a
                        href={row.href}
                        className="text-primary font-mono font-medium underline-offset-4 hover:underline"
                        data-testid="receivable-unit"
                      >
                        {row.unitNo}
                      </a>
                    ) : (
                      <span className="font-mono font-medium">{row.unitNo}</span>
                    )}
                  </td>
                  <td className="max-w-72 px-4 py-3 align-top">{owner(row)}</td>
                  <td className="px-4 py-3 text-end align-top font-medium tabular-nums">{money(row.outstanding)}</td>
                  <td className="px-4 py-3 text-end align-top tabular-nums">{surcharge(row.surcharge)}</td>
                  <td className="px-4 py-3 align-top">{overdue(row)}</td>
                  <td className="px-4 py-3 align-top">
                    <NextStepBadgeView row={row} locale={locale} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ChannelIcons channels={row.channels} className="justify-end" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per account. */}
      <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" data-testid="receivables-cards">
        {rows.map((row) => {
          const on = selected.has(key(row));
          return (
            <li
              key={key(row)}
              onClick={open(row)}
              className={cn(
                "border-border bg-surface rounded-card shadow-card flex flex-col gap-3 border p-4",
                on && "border-primary/40 bg-primary-subtle",
              )}
              data-testid="receivable-card"
              data-unit={row.unitNo}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {canManage ? (
                    <Checkbox
                      label={<span className="sr-only">{t("bulk.selectRow", { unit: row.unitNo })}</span>}
                      checked={on}
                      onCheckedChange={(value) => toggle(row, value === true)}
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {row.href ? (
                      <a href={row.href} className="text-primary font-mono font-medium">
                        {row.unitNo}
                      </a>
                    ) : (
                      <span className="font-mono font-medium">{row.unitNo}</span>
                    )}
                    {owner(row)}
                  </div>
                </div>
                <span className="text-end font-semibold tabular-nums">{money(row.outstanding)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <NextStepBadgeView row={row} locale={locale} />
                <span className="text-muted text-sm tabular-nums">
                  {row.oldestOverdueOn ? t("months", { count: row.oldestOverdueMonths }) : t("noneOverdue")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
