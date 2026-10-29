"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

type Settings = Schemas["BroadcastSettingsDto"];
type NumberKey =
  "maxPerWeek" | "maxListings" | "sendWindowHours" | "attributionDays" | "deliveryKeepMonths" | "preferencesKeepDays";

const NUMBERS: { key: NumberKey; label: string; hint: string; unit: string; min: number; max: number }[] = [
  { key: "maxPerWeek", label: "maxPerWeek", hint: "maxPerWeekHint", unit: "messages", min: 0, max: 7 },
  { key: "maxListings", label: "maxListings", hint: "maxListingsHint", unit: "listings", min: 1, max: 10 },
  { key: "sendWindowHours", label: "sendWindowHours", hint: "sendWindowHint", unit: "hours", min: 1, max: 168 },
  { key: "attributionDays", label: "attributionDays", hint: "attributionHint", unit: "days", min: 1, max: 60 },
  {
    key: "deliveryKeepMonths",
    label: "deliveryKeepMonths",
    hint: "deliveryKeepHint",
    unit: "months",
    min: 1,
    max: 36,
  },
  {
    key: "preferencesKeepDays",
    label: "preferencesKeepDays",
    hint: "preferencesKeepHint",
    unit: "days",
    min: 0,
    max: 90,
  },
];

const whole = (value: string) => (/^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : null);

/**
 * The eight sponsored broadcast settings (G6, D-291, D-300) as one form: only the values that changed are sent, all
 * with the required reason (each becomes a new setting version from now). Switching the service **on** also asks for
 * LINE Thailand's written confirmation (O-023) — the API cannot check it, the console makes it explicit. The consent
 * text quotes the weekly limit and the keep periods: changing them reminds to publish a new text version.
 */
export function BroadcastSettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("admin.broadcast.settings");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [lineConfirmed, setLineConfirmed] = useState(false);
  const [numbers, setNumbers] = useState<Record<NumberKey, string>>(
    () => Object.fromEntries(NUMBERS.map((n) => [n.key, String(settings[n.key])])) as Record<NumberKey, string>,
  );
  const [quietStart, setQuietStart] = useState(settings.quietHours.start);
  const [quietEnd, setQuietEnd] = useState(settings.quietHours.end);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const action = useApiAction<Settings>();
  const apiErrors = fieldErrors(action.error);

  const invalid = Object.fromEntries(
    NUMBERS.map((n) => {
      const value = whole(numbers[n.key]);
      return [n.key, value === null || value < n.min || value > n.max ? `${n.min}–${n.max}` : undefined];
    }),
  ) as Record<NumberKey, string | undefined>;

  const changes: Partial<Schemas["BroadcastSettingsUpdateDto"]> = {};
  if (enabled !== settings.enabled) changes.enabled = enabled;
  for (const n of NUMBERS) {
    const value = whole(numbers[n.key]);
    if (value !== null && value !== settings[n.key]) changes[n.key] = value;
  }
  if (quietStart !== settings.quietHours.start || quietEnd !== settings.quietHours.end)
    changes.quietHours = { start: quietStart, end: quietEnd, timezone: settings.quietHours.timezone };
  const changed = Object.keys(changes).length > 0;
  const switchingOn = enabled && !settings.enabled;
  const quotedChanged = changes.maxPerWeek !== undefined || changes.preferencesKeepDays !== undefined;
  const reasonError = submitted && !reason.trim() ? t("reasonRequired") : undefined;
  const confirmError = submitted && switchingOn && !lineConfirmed ? t("confirmLineRequired") : undefined;

  const save = () => {
    setSubmitted(true);
    if (!changed || !reason.trim() || (switchingOn && !lineConfirmed) || Object.values(invalid).some(Boolean)) return;
    void action.run(
      () => unwrap(browserApi().PUT("/v1/admin/broadcast/settings", { body: { ...changes, reason: reason.trim() } })),
      () => {
        toast.success(t("saved"));
        setReason("");
        setSubmitted(false);
        setLineConfirmed(false);
      },
    );
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      data-testid="broadcast-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="rounded-card border-border flex flex-col gap-3 border p-4">
        <Switch
          label={t("enabled")}
          description={<span className="font-mono text-xs">{t("enabledHint")}</span>}
          checked={enabled}
          onCheckedChange={setEnabled}
          name="enabled"
        />
        {switchingOn ? (
          <div className="flex flex-col gap-1" data-testid="broadcast-confirm-line">
            <Checkbox
              label={t("confirmLine")}
              checked={lineConfirmed}
              onCheckedChange={(value) => setLineConfirmed(value === true)}
            />
            {confirmError ? (
              <Callout tone="danger">
                <span role="alert">{confirmError}</span>
              </Callout>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {NUMBERS.map((n) => (
          <Field
            key={n.key}
            label={t(n.label)}
            hint={t(n.hint)}
            error={(submitted && invalid[n.key]) || apiErrors[n.key]}
          >
            <NumberInput
              inputMode="numeric"
              unit={t(`unit.${n.unit}`)}
              value={numbers[n.key]}
              onChange={(event) => setNumbers((current) => ({ ...current, [n.key]: event.target.value }))}
              data-testid={`broadcast-${n.key}`}
            />
          </Field>
        ))}
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">{t("quietHours")}</legend>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <Field label={t("quietStart")} error={apiErrors.quietHours}>
            <Input
              type="time"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
              data-testid="broadcast-quiet-start"
            />
          </Field>
          <Field label={t("quietEnd")}>
            <Input
              type="time"
              value={quietEnd}
              onChange={(event) => setQuietEnd(event.target.value)}
              data-testid="broadcast-quiet-end"
            />
          </Field>
        </div>
        <p className="text-muted m-0 text-xs">{t("quietHint")}</p>
      </fieldset>

      {quotedChanged ? <Callout tone="warning">{t("consentQuotes")}</Callout> : null}

      <Field label={t("reason")} hint={t("reasonHint")} error={reasonError ?? apiErrors.reason} required>
        <Textarea
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          data-testid="broadcast-reason"
        />
      </Field>

      <ProblemNotice error={action.error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={action.busy} disabled={!changed} data-testid="broadcast-save">
          {t("save")}
        </Button>
        {!changed ? <span className="text-muted text-sm">{t("nothingChanged")}</span> : null}
      </div>
    </form>
  );
}
