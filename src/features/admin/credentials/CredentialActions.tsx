"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconRemove } from "@/ui/icons/glyphs/remove";

import {
  CREDENTIAL_LIMITS,
  credentialFormProblems,
  credentialValues,
  keyTemplate,
  kindsFor,
  providersFor,
  type CredentialKind,
} from "./providers";

interface KeyRow {
  id: number;
  name: string;
}

/** A credential to rotate: the same account, its current key names (the values are never known here). */
export interface RotationPreset {
  kind: CredentialKind;
  provider: string;
  keyNames: string[];
  accountRefHint: string | null;
}

/**
 * `POST /v1/admin/provider-credentials` (D-240): sets — or, for an account that has one, replaces — the live
 * credential of a tenant's merchant / lock vendor / e-Tax account, or of the platform's own merchant
 * (`tenantId: null`, payments only). The values are **write-only**: typed into password fields that the
 * browser is told not to remember, held in no React state, sent once with the dialog's Idempotency-Key and
 * gone when the dialog closes; the answer and the list show only key names and a fingerprint.
 */
export function SetProviderCredential({
  tenantId,
  preset,
  label,
  testId,
}: {
  /** The tenant whose account this is; `null` = the platform merchant. */
  tenantId: string | null;
  /** Rotation of an existing credential: kind and provider fixed, its key names as the rows. */
  preset?: RotationPreset;
  label: string;
  testId: string;
}) {
  const t = useTranslations("admin.credentials");
  const providerName = (value: string) => (t.has(`provider.${value}`) ? t(`provider.${value}`) : value);
  const kinds = kindsFor(tenantId);
  const [kind, setKind] = useState<CredentialKind>(preset?.kind ?? kinds[0]!);
  const [provider, setProvider] = useState(preset?.provider ?? providersFor(preset?.kind ?? kinds[0]!)[0]!);
  const [rows, setRows] = useState<KeyRow[]>(() =>
    (preset ? preset.keyNames : keyTemplate(provider)).map((name, id) => ({ id, name })),
  );
  const [nextId, setNextId] = useState(1000);
  const [problems, setProblems] = useState<string[]>([]);

  const resetRows = (names: string[]) => {
    setRows(names.map((name, id) => ({ id: nextId + id, name })));
    setNextId(nextId + names.length);
    setProblems([]);
  };
  const chooseKind = (value: CredentialKind) => {
    const first = providersFor(value)[0]!;
    setKind(value);
    setProvider(first);
    resetRows(keyTemplate(first));
  };
  const chooseProvider = (value: string) => {
    setProvider(value);
    resetRows(keyTemplate(value));
  };

  return (
    <FormDialog
      label={label}
      icon={preset ? IconRefresh : IconKey}
      variant={preset ? "secondary" : "primary"}
      size={preset ? "sm" : "md"}
      testId={testId}
      size_="lg"
      title={
        preset
          ? t("form.rotateTitle", { provider: providerName(preset.provider) })
          : tenantId === null
            ? t("form.platformTitle")
            : t("form.title")
      }
      description={t("form.hint")}
      submitLabel={t("form.submit")}
      onSubmit={async (data, _ack, idempotencyKey) => {
        const entries = rows.map((row) => ({
          name: String(data.get(`key-${row.id}`) ?? row.name),
          value: String(data.get(`value-${row.id}`) ?? ""),
        }));
        const found = credentialFormProblems(entries);
        setProblems(found);
        if (found.length > 0) throw new Error(t("form.fix"));
        const stored = await unwrap(
          browserApi().POST("/v1/admin/provider-credentials", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              tenantId,
              kind,
              provider,
              merchantRef: kind === "payment" ? text(data, "merchantRef") : undefined,
              values: credentialValues(entries),
              reason: text(data, "reason") ?? "",
            },
          }),
        );
        return stored;
      }}
      onDone={(result) => {
        const stored = result as Schemas["ProviderCredentialDto"];
        toast.success(t("form.stored", { fingerprint: stored.fingerprint }));
      }}
    >
      {(errors) => (
        <div className="flex flex-col gap-4">
          <Callout tone="info" title={t("writeOnlyTitle")}>
            {t("writeOnlyBody")}
          </Callout>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.kind")} required error={errors.kind}>
              <NativeSelect
                name="kind"
                value={kind}
                disabled={Boolean(preset) || kinds.length === 1}
                onChange={(event) => chooseKind(event.target.value as CredentialKind)}
                options={kinds.map((value) => ({ value, label: t(`kind.${value}`) }))}
                data-testid="credential-kind"
              />
            </Field>
            <Field label={t("form.provider")} required error={errors.provider}>
              <NativeSelect
                name="provider"
                value={provider}
                disabled={Boolean(preset)}
                onChange={(event) => chooseProvider(event.target.value)}
                options={(preset && !providersFor(kind).includes(preset.provider)
                  ? [...providersFor(kind), preset.provider]
                  : providersFor(kind)
                ).map((value) => ({ value, label: providerName(value) }))}
                data-testid="credential-provider"
              />
            </Field>
          </div>
          {kind === "payment" ? (
            <Field
              label={t("form.merchantRef")}
              required
              hint={
                preset?.accountRefHint
                  ? t("form.merchantRefRotate", { hint: preset.accountRefHint })
                  : t("form.merchantRefHint")
              }
              error={errors.merchantRef}
            >
              <Input
                name="merchantRef"
                required
                maxLength={CREDENTIAL_LIMITS.merchantRefMax}
                autoComplete="off"
                spellCheck={false}
                data-testid="credential-merchant-ref"
              />
            </Field>
          ) : null}
          <fieldset className="flex flex-col gap-3" data-testid="credential-values">
            <legend className="mb-1 text-sm font-semibold">{t("form.values")}</legend>
            <p className="text-muted text-sm">{t("form.valuesHint")}</p>
            {rows.map((row, index) => (
              <div key={row.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                <Field label={t("form.keyName", { index: index + 1 })}>
                  <Input
                    name={`key-${row.id}`}
                    defaultValue={row.name}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    data-testid="credential-key"
                  />
                </Field>
                <Field label={t("form.keyValue", { index: index + 1 })}>
                  {/* Write-only: never echoed, never remembered by the browser, never in React state. */}
                  <Input
                    name={`value-${row.id}`}
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    maxLength={CREDENTIAL_LIMITS.maxValueLength}
                    data-testid="credential-value"
                  />
                </Field>
                <Button
                  variant="ghost"
                  iconStart={IconRemove}
                  onClick={() => setRows(rows.filter((candidate) => candidate.id !== row.id))}
                  disabled={rows.length === 1}
                  aria-label={t("form.removeKey", { index: index + 1 })}
                >
                  <span className="sr-only sm:not-sr-only">{t("form.remove")}</span>
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              iconStart={IconAdd}
              className="self-start"
              disabled={rows.length >= CREDENTIAL_LIMITS.maxKeys}
              onClick={() => {
                setRows([...rows, { id: nextId, name: "" }]);
                setNextId(nextId + 1);
              }}
              data-testid="credential-add-key"
            >
              {t("form.addKey")}
            </Button>
            {errors.values || problems.length > 0 ? (
              <Callout tone="danger" title={t("form.fix")}>
                <ul className="list-disc ps-5" data-testid="credential-problems">
                  {problems.map((problem) => (
                    <li key={problem}>{t(`form.problem.${problem}`)}</li>
                  ))}
                  {errors.values ? <li>{errors.values}</li> : null}
                </ul>
              </Callout>
            ) : null}
          </fieldset>
          <Field label={t("form.reason")} required hint={t("form.reasonHint")} error={errors.reason}>
            <Textarea
              name="reason"
              rows={2}
              required
              minLength={CREDENTIAL_LIMITS.reasonMin}
              maxLength={CREDENTIAL_LIMITS.reasonMax}
              data-testid="credential-reason"
            />
          </Field>
          {preset ? (
            <Callout tone="warning" title={t("form.replacesTitle")}>
              {t("form.replacesBody")}
            </Callout>
          ) : null}
        </div>
      )}
    </FormDialog>
  );
}

/**
 * `POST /v1/admin/provider-credentials/{credentialId}/actions/revoke` (D-240): the adapter has no credential
 * afterwards — QR codes, lock syncs or e-Tax submissions of that account fail until a new one is set. Typed
 * with the credential's fingerprint, a reason and an optional incident reference; one Idempotency-Key per
 * opening of the dialog.
 */
export function RevokeProviderCredential({ credential }: { credential: Schemas["ProviderCredentialDto"] }) {
  const t = useTranslations("admin.credentials");
  const providerName = t.has(`provider.${credential.provider}`)
    ? t(`provider.${credential.provider}`)
    : credential.provider;
  const [reason, setReason] = useState("");
  const [incident, setIncident] = useState("");
  const trimmed = reason.trim();
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconRemove}
      variant="destructive"
      size="sm"
      tone="destructive"
      testId="revoke-credential"
      title={t("revokeTitle", { provider: providerName })}
      description={t(`revokeBody.${credential.kind}`)}
      confirmLabel={t("revoke")}
      phrase={credential.fingerprint}
      ready={trimmed.length >= CREDENTIAL_LIMITS.reasonMin && trimmed.length <= CREDENTIAL_LIMITS.reasonMax}
      successMessage={t("revoked")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/admin/provider-credentials/{credentialId}/actions/revoke", {
            params: { path: { credentialId: credential.id }, header: { "Idempotency-Key": key } },
            body: { reason: trimmed, incidentRef: incident.trim() || null },
          }),
        )
      }
    >
      <Field label={t("form.reason")} required hint={t("form.reasonHint")}>
        <Textarea
          rows={2}
          maxLength={CREDENTIAL_LIMITS.reasonMax}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid="revoke-reason"
        />
      </Field>
      <Field label={t("incident")}>
        <Input value={incident} maxLength={64} onChange={(event) => setIncident(event.target.value)} />
      </Field>
    </ConfirmAction>
  );
}
