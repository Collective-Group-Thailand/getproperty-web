"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FieldError } from "@/ui/components/FieldError";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";

import { BAND_ROLES, checkBands, type ApprovalBand, type BandProblem, type BandRole } from "./bands";
import { normaliseAmount } from "./money";
import { checkWhtRates, type WhtRate, type WhtRateProblem } from "./wht";

interface BandRow {
  key: string;
  upTo: string;
  roles: BandRole[];
  approvals: number;
}

/** Saves a json setting as a new tenant version with a reason (ADR-0004); the API validates it again. */
function useSettingSave(key: string) {
  const action = useApiAction();
  const save = (value: unknown, reason: string, onDone: () => void) =>
    action.run(
      () =>
        unwrap(
          browserApi().PUT("/v1/owner/settings/{key}", {
            params: { path: { key } },
            body: { value: value as never, reason },
          }),
        ),
      onDone,
    );
  return { action, save };
}

/**
 * The approval bands (D-311, `juristic.approval_bands`): one row per band — the upper limit (the last band is "and
 * above"), the roles that may approve and how many distinct people must. Checked before sending (ascending limits,
 * at least one role, 1–5 approvals); saved as a new version with the reason the committee decided it.
 */
export function BandsEditor({ bands, editable }: { bands: ApprovalBand[]; editable: boolean }) {
  const t = useTranslations("owner.accounting.bandsEditor");
  const roles = useTranslations("owner.accounting.band.role");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState<BandRow[]>(
    bands.map((band, index) => ({
      key: `b${index}`,
      upTo: band.upTo ?? "",
      roles: [...band.roles],
      approvals: band.approvals,
    })),
  );
  const [reason, setReason] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { action, save } = useSettingSave("juristic.approval_bands");
  const check = checkBands(rows);
  const problem = (index: number): BandProblem | null => (attempt > 0 ? (check.rows[index]?.[0] ?? null) : null);
  const update = (key: string, patch: Partial<BandRow>) =>
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = () => {
    setAttempt((n) => n + 1);
    if (!check.ok || reason.trim().length < 3) return;
    const value = rows.map((row, index) => ({
      upTo: index === rows.length - 1 ? null : normaliseAmount(row.upTo),
      roles: row.roles,
      approvals: row.approvals,
    }));
    void save(value, reason.trim(), () => {
      setReason("");
      setAttempt(0);
      toast.success(t("saved"));
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-5 md:px-6" data-testid="bands-editor">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => {
          const last = index === rows.length - 1;
          const previous = index > 0 ? rows[index - 1]?.upTo : "";
          const error = problem(index);
          return (
            <li
              key={row.key}
              className="border-border rounded-control grid gap-4 border p-4 md:grid-cols-[13rem_minmax(0,1fr)_8rem_auto] md:items-start"
              data-testid="band-row"
            >
              <Field
                label={last ? t("above") : t("upTo")}
                hint={
                  last
                    ? previous
                      ? t("aboveHint", { amount: formatTHB(normaliseAmount(previous) ?? "0", locale) })
                      : t("anyHint")
                    : t("upToHint")
                }
                error={error === "upTo" || error === "order" ? t(`error.${error}`) : undefined}
              >
                {last ? (
                  <Input value={t("andAbove")} disabled aria-readonly />
                ) : (
                  <Input
                    value={row.upTo}
                    onChange={(event) => update(row.key, { upTo: event.target.value })}
                    inputMode="decimal"
                    disabled={!editable}
                    className="text-end tabular-nums"
                    data-testid="band-up-to"
                  />
                )}
              </Field>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 text-sm font-medium">{t("roles")}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {BAND_ROLES.map((role) => (
                    <Checkbox
                      key={role}
                      label={roles(role)}
                      checked={row.roles.includes(role)}
                      disabled={!editable}
                      onCheckedChange={(checked) =>
                        update(row.key, {
                          roles: checked
                            ? BAND_ROLES.filter((value) => value === role || row.roles.includes(value))
                            : row.roles.filter((value) => value !== role),
                        })
                      }
                    />
                  ))}
                </div>
                {error === "roles" ? <FieldError>{t("error.roles")}</FieldError> : null}
              </fieldset>
              <Field label={t("approvals")} error={error === "approvals" ? t("error.approvals") : undefined}>
                <NativeSelect
                  value={String(row.approvals)}
                  disabled={!editable}
                  onChange={(event) => update(row.key, { approvals: Number(event.target.value) })}
                  options={[1, 2, 3, 4, 5].map((value) => ({
                    value: String(value),
                    label: t("people", { count: value }),
                  }))}
                  data-testid="band-approvals"
                />
              </Field>
              {editable ? (
                <Button
                  variant="ghost"
                  iconStart={IconDelete}
                  disabled={rows.length <= 1}
                  onClick={() => setRows((all) => all.filter((item) => item.key !== row.key))}
                  aria-label={t("remove", { n: index + 1 })}
                  className="justify-self-end md:mt-7"
                >
                  <span className="sr-only">{t("remove", { n: index + 1 })}</span>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {editable ? (
        <>
          <div>
            <Button
              variant="secondary"
              size="sm"
              iconStart={IconAdd}
              disabled={rows.length >= 10}
              onClick={() =>
                setRows((all) => [
                  ...all.slice(0, -1),
                  { key: `n${Date.now()}`, upTo: "", roles: ["owner", "manager", "committee"], approvals: 1 },
                  ...all.slice(-1),
                ])
              }
              data-testid="band-add"
            >
              {t("add")}
            </Button>
          </div>
          <Field
            label={t("reason")}
            hint={t("reasonHint")}
            required
            error={attempt > 0 && reason.trim().length < 3 ? t("error.reason") : undefined}
          >
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
              data-testid="bands-reason"
            />
          </Field>
          <ProblemNotice error={action.error} />
          <div className="flex justify-end">
            <Button onClick={submit} loading={action.busy} data-testid="bands-save">
              {t("save")}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted m-0 text-sm">{t("readOnly")}</p>
      )}
    </div>
  );
}

/**
 * Withholding-tax rates as data (`juristic.wht_rates`, ⚖ O-041): key, Thai and English label, the income type printed
 * on the 50 ทวิ, the rate and whether a tax adviser confirmed it. The console holds no rate of its own; an
 * unconfirmed rate keeps its badge everywhere it is used.
 */
export function WhtRatesEditor({ rates, editable }: { rates: WhtRate[]; editable: boolean }) {
  const t = useTranslations("owner.accounting.whtEditor");
  const [rows, setRows] = useState<(WhtRate & { row: string })[]>(
    rates.map((rate, index) => ({ ...rate, row: `r${index}` })),
  );
  const [reason, setReason] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { action, save } = useSettingSave("juristic.wht_rates");
  const check = checkWhtRates(rows);
  const problem = (index: number): WhtRateProblem | null => (attempt > 0 ? (check.rows[index]?.[0] ?? null) : null);
  const update = (row: string, patch: Partial<WhtRate>) =>
    setRows((all) => all.map((item) => (item.row === row ? { ...item, ...patch } : item)));

  const submit = () => {
    setAttempt((n) => n + 1);
    if (!check.ok || reason.trim().length < 3) return;
    const value = rows.map(({ row: _row, ...rate }) => ({ ...rate, ratePct: rate.ratePct.trim() }));
    void save(value, reason.trim(), () => {
      setReason("");
      setAttempt(0);
      toast.success(t("saved"));
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-5 md:px-6" data-testid="wht-editor">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((rate, index) => {
          const error = problem(index);
          return (
            <li
              key={rate.row}
              className="border-border rounded-control flex flex-col gap-3 border p-4"
              data-testid="wht-row"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm">{rate.key || t("newKey")}</span>
                {rate.verified ? (
                  <Badge size="sm" tone="success">
                    {t("verified")}
                  </Badge>
                ) : (
                  <Badge size="sm" tone="warning">
                    {t("unverified")}
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_8rem_7rem]">
                <Field
                  label={t("key")}
                  error={error === "key" || error === "duplicate" ? t(`error.${error}`) : undefined}
                >
                  <Input
                    value={rate.key}
                    disabled={!editable || rate.row.startsWith("r")}
                    onChange={(event) => update(rate.row, { key: event.target.value.trim() })}
                    className="font-mono"
                  />
                </Field>
                <Field label={t("labelTh")} error={error === "label" ? t("error.label") : undefined}>
                  <Input
                    value={rate.labelTh}
                    disabled={!editable}
                    onChange={(event) => update(rate.row, { labelTh: event.target.value })}
                  />
                </Field>
                <Field label={t("labelEn")}>
                  <Input
                    value={rate.labelEn}
                    disabled={!editable}
                    onChange={(event) => update(rate.row, { labelEn: event.target.value })}
                  />
                </Field>
                <Field label={t("incomeType")} error={error === "incomeType" ? t("error.incomeType") : undefined}>
                  <Input
                    value={rate.incomeType}
                    disabled={!editable}
                    onChange={(event) => update(rate.row, { incomeType: event.target.value })}
                  />
                </Field>
                <Field label={t("rate")} error={error === "rate" ? t("error.rate") : undefined}>
                  <Input
                    value={rate.ratePct}
                    disabled={!editable}
                    inputMode="decimal"
                    onChange={(event) => update(rate.row, { ratePct: event.target.value })}
                    className="text-end tabular-nums"
                    data-testid="wht-rate"
                  />
                </Field>
              </div>
              {editable ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Switch
                    label={t("verifiedSwitch")}
                    description={t("verifiedHint")}
                    checked={rate.verified}
                    onCheckedChange={(checked) => update(rate.row, { verified: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconStart={IconDelete}
                    onClick={() => setRows((all) => all.filter((item) => item.row !== rate.row))}
                  >
                    {t("remove")}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <>
          <div>
            <Button
              variant="secondary"
              size="sm"
              iconStart={IconAdd}
              disabled={rows.length >= 30}
              onClick={() =>
                setRows((all) => [
                  ...all,
                  {
                    row: `n${Date.now()}`,
                    key: "",
                    labelTh: "",
                    labelEn: "",
                    incomeType: "",
                    ratePct: "",
                    verified: false,
                  },
                ])
              }
              data-testid="wht-add"
            >
              {t("add")}
            </Button>
          </div>
          <Field
            label={t("reason")}
            hint={t("reasonHint")}
            required
            error={attempt > 0 && reason.trim().length < 3 ? t("error.reason") : undefined}
          >
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} />
          </Field>
          <ProblemNotice error={action.error} />
          <div className="flex justify-end">
            <Button onClick={submit} loading={action.busy} data-testid="wht-save">
              {t("save")}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted m-0 text-sm">{t("readOnly")}</p>
      )}
    </div>
  );
}
