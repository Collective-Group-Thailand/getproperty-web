"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCommand } from "@/ui/icons/glyphs/command";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { buildingLabel, DEVICE_KINDS, RINGS } from "./constants";

/** `nextActions` of a live gateway → the command it allows (D-131); `set_log_level` goes with them (admin only, D-183). */
const COMMAND_ACTIONS: Record<string, Schemas["CommandType"]> = {
  identify: "identify",
  "read-now": "read_now",
  restart: "restart",
  "upload-logs": "upload_logs",
};
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

/**
 * The buildings of the tenant chosen in the assign dialog (`GET /v1/admin/tenants/{tenantId}/buildings`), read
 * when the tenant changes; `null` while reading.
 */
function useTenantBuildings(tenantId: string, enabled: boolean) {
  const [state, setState] = useState<{
    tenantId: string;
    buildings: Schemas["AdminBuildingDto"][] | null;
    error: unknown;
  }>({ tenantId: "", buildings: null, error: null });
  useEffect(() => {
    if (!enabled || !tenantId) return;
    let alive = true;
    void unwrap(browserApi().GET("/v1/admin/tenants/{tenantId}/buildings", { params: { path: { tenantId } } }))
      .then((buildings) => alive && setState({ tenantId, buildings, error: null }))
      .catch((error: unknown) => alive && setState({ tenantId, buildings: [], error }));
    return () => {
      alive = false;
    };
  }, [enabled, tenantId]);
  return state.tenantId === tenantId ? state : { tenantId, buildings: null, error: null };
}

/**
 * `POST /v1/admin/devices/actions/import` — inventory from a CSV (`serial,kind,model,vendor[,driver,ownership,arch]`).
 * The API refuses the whole file on any error and lists the lines; serials already registered are skipped.
 */
export function ImportDevices() {
  const t = useTranslations("admin.fleet.import");
  const [result, setResult] = useState<Schemas["DeviceImportResultDto"] | null>(null);
  return (
    <FormDialog
      label={t("open")}
      icon={IconUpload}
      testId="import-devices"
      title={t("title")}
      description={t("hint")}
      submitLabel={t("submit")}
      size_="lg"
      onSubmit={async (data) => {
        const file = data.get("file");
        const csv = file instanceof File && file.size > 0 ? await file.text() : String(data.get("csv") ?? "");
        const answer = await unwrap(
          browserApi().POST("/v1/admin/devices/actions/import", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: { csv },
          }),
        );
        setResult(answer);
        // A file with errors created nothing: keep the dialog open with the lines to fix.
        if (answer.errors.length > 0) throw new Error(t("refused", { count: answer.errors.length }));
        return answer;
      }}
      successMessage={t("done")}
    >
      {(errors) => (
        <>
          <Field label={t("file")} hint={t("fileHint")} error={errors.csv}>
            <Input name="file" type="file" accept=".csv,text/csv" data-testid="import-file" />
          </Field>
          <Field label={t("paste")} hint={t("pasteHint")}>
            <Textarea
              name="csv"
              rows={6}
              className="font-mono text-sm"
              data-testid="import-csv"
              placeholder={t("placeholder")}
            />
          </Field>
          {result ? (
            <div className="flex flex-col gap-2" data-testid="import-result">
              {result.errors.length > 0 ? (
                <Callout tone="danger" title={t("errorsTitle", { count: result.errors.length })}>
                  <ul className="list-disc ps-5">
                    {result.errors.map((error) => (
                      <li key={`${error.line}-${error.message}`} data-testid="import-error">
                        {t("line", { line: error.line })}: {error.message}
                      </li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
              {result.skipped.length > 0 ? (
                <Callout tone="info" title={t("skippedTitle", { count: result.skipped.length })}>
                  <ul className="list-disc ps-5">
                    {result.skipped.map((row) => (
                      <li key={`${row.line}-${row.serial}`}>
                        {t("line", { line: row.line })}: {row.serial} — {row.reason}
                      </li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </FormDialog>
  );
}

/** `POST /v1/admin/devices` — one device into the inventory (or straight to a tenant's building). */
export function RegisterDevice() {
  const t = useTranslations("admin.fleet.register");
  const kinds = useTranslations("admin.fleet.kind");
  return (
    <FormDialog
      label={t("open")}
      icon={IconAdd}
      variant="primary"
      testId="register-device"
      title={t("title")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/devices", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              serial: text(data, "serial") ?? "",
              kind: (text(data, "kind") ?? "gateway") as Schemas["DeviceKind"],
              model: text(data, "model") ?? "",
              vendor: text(data, "vendor") ?? "",
              ownership: (text(data, "ownership") ?? "platform_haas") as Schemas["DeviceOwnership"],
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("serial")} required error={errors.serial}>
            <Input name="serial" required autoComplete="off" data-testid="device-serial" />
          </Field>
          <Field label={t("kind")} required error={errors.kind}>
            <NativeSelect name="kind" options={DEVICE_KINDS.map((kind) => ({ value: kind, label: kinds(kind) }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("vendor")} required error={errors.vendor}>
              <Input name="vendor" required />
            </Field>
            <Field label={t("model")} required error={errors.model}>
              <Input name="model" required />
            </Field>
          </div>
          <Field label={t("ownership")} error={errors.ownership}>
            <NativeSelect
              name="ownership"
              options={(["platform_haas", "tenant_owned"] as const).map((value) => ({
                value,
                label: t(`ownershipName.${value}`),
              }))}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * What the API offers on one device (`nextActions`): assign to a tenant's building (inventory only),
 * OTA ring, a provisioning code for the installer, a command, revoke the gateway's certificates and
 * retire — the last two irreversible, typed with the serial and a reason (D-131).
 */
export function DeviceActions({
  device,
  tenants,
}: {
  device: Schemas["FleetDeviceDto"];
  tenants: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.fleet.actions");
  const commands = useTranslations("admin.fleet.command");
  const [reason, setReason] = useState("");
  const [incident, setIncident] = useState("");
  const [tenantId, setTenantId] = useState(device.tenantId ?? tenants[0]?.id ?? "");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState<Schemas["ProvisioningCodeDto"] | null>(null);
  const codeAction = useApiAction<Schemas["ProvisioningCodeDto"]>({ refresh: false });
  const actions = new Set(device.nextActions);
  const path = { params: { path: { deviceId: device.id } } };
  const gateway = device.kind === "gateway";
  const offered = Object.entries(COMMAND_ACTIONS)
    .filter(([action]) => actions.has(action))
    .map(([, type]) => type);
  const commandTypes: Schemas["CommandType"][] = offered.length ? [...offered, "set_log_level"] : [];
  // The API issues a code to a gateway assigned to a tenant's building (device-registry.service.ts).
  const canIssueCode = gateway && device.status !== "retired" && Boolean(device.tenantId && device.buildingId);
  const reasonFields = (id: string) => (
    <>
      <Field label={t("reason")} required>
        <Textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid={`${id}-reason`}
        />
      </Field>
      <Field label={t("incident")}>
        <Input value={incident} onChange={(event) => setIncident(event.target.value)} />
      </Field>
    </>
  );
  const tenantBuildings = useTenantBuildings(tenantId, actions.has("assign"));

  return (
    <div className="flex flex-col gap-3" data-testid="device-actions">
      <div className="flex flex-wrap gap-2">
        {actions.has("assign") ? (
          <FormDialog
            label={t("assign")}
            icon={IconLink}
            variant="primary"
            testId="assign-device"
            title={t("assignTitle", { serial: device.serial })}
            description={t("assignHint")}
            submitLabel={t("assign")}
            successMessage={t("assigned")}
            onSubmit={(data) =>
              unwrap(
                browserApi().POST("/v1/admin/devices/{deviceId}/actions/assign", {
                  ...path,
                  body: {
                    tenantId,
                    buildingId: text(data, "buildingId") ?? "",
                    otaRing: gateway ? ((text(data, "otaRing") ?? "all") as Schemas["OtaRing"]) : undefined,
                  },
                }),
              )
            }
          >
            {(errors) => (
              <>
                <Field label={t("tenant")} required error={errors.tenantId}>
                  <NativeSelect
                    name="tenantId"
                    value={tenantId}
                    onChange={(event) => setTenantId(event.target.value)}
                    options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
                    data-testid="assign-tenant"
                  />
                </Field>
                <Field
                  label={t("building")}
                  required
                  error={errors.buildingId}
                  hint={
                    tenantBuildings.buildings?.length === 0 && !tenantBuildings.error ? t("noBuildings") : undefined
                  }
                >
                  <NativeSelect
                    name="buildingId"
                    required
                    disabled={!tenantBuildings.buildings?.length}
                    placeholder={tenantBuildings.buildings === null ? t("loadingBuildings") : undefined}
                    options={(tenantBuildings.buildings ?? []).map((building) => ({
                      value: building.id,
                      label: buildingLabel(building),
                    }))}
                    data-testid="assign-building"
                  />
                </Field>
                <ProblemNotice error={tenantBuildings.error} />
                {gateway ? (
                  <Field label={t("ring")} error={errors.otaRing}>
                    <NativeSelect
                      name="otaRing"
                      defaultValue="all"
                      options={RINGS.map((ring) => ({ value: ring, label: t(`ringName.${ring}`) }))}
                    />
                  </Field>
                ) : null}
              </>
            )}
          </FormDialog>
        ) : null}
        {actions.has("set-ring") ? (
          <FormDialog
            label={t("setRing")}
            icon={IconCommand}
            testId="set-ring"
            title={t("setRingTitle", { serial: device.serial })}
            description={t("setRingHint")}
            submitLabel={t("save")}
            successMessage={t("ringSet")}
            onSubmit={(data) =>
              unwrap(
                browserApi().POST("/v1/admin/devices/{deviceId}/actions/set-ring", {
                  ...path,
                  body: { otaRing: (text(data, "otaRing") ?? device.otaRing) as Schemas["OtaRing"] },
                }),
              )
            }
          >
            {(errors) => (
              <Field label={t("ring")} error={errors.otaRing}>
                <NativeSelect
                  name="otaRing"
                  defaultValue={device.otaRing}
                  options={RINGS.map((ring) => ({ value: ring, label: t(`ringName.${ring}`) }))}
                  data-testid="ring-select"
                />
              </Field>
            )}
          </FormDialog>
        ) : null}
        {commandTypes.length > 0 ? (
          <FormDialog
            label={t("command")}
            icon={IconCommand}
            testId="send-command"
            title={t("commandTitle", { serial: device.serial })}
            description={t("commandHint")}
            submitLabel={t("send")}
            successMessage={t("sent")}
            onSubmit={(data) => {
              const type = (text(data, "type") ?? "identify") as Schemas["CommandType"];
              const level = text(data, "level");
              return unwrap(
                browserApi().POST("/v1/admin/devices/{deviceId}/commands", {
                  ...path,
                  body: { type, args: type === "set_log_level" && level ? { level } : {} },
                }),
              );
            }}
          >
            {(errors) => (
              <>
                <Field label={t("commandType")} required error={errors.type}>
                  <NativeSelect
                    name="type"
                    options={commandTypes.map((type) => ({ value: type, label: commands(type) }))}
                    data-testid="command-type"
                  />
                </Field>
                <Field label={t("logLevel")} hint={t("logLevelHint")}>
                  <NativeSelect
                    name="level"
                    defaultValue="info"
                    options={LOG_LEVELS.map((level) => ({ value: level, label: level }))}
                  />
                </Field>
              </>
            )}
          </FormDialog>
        ) : null}
        {canIssueCode ? (
          <Button
            variant="secondary"
            iconStart={IconQr}
            loading={codeAction.busy}
            data-testid="provisioning-code"
            onClick={() =>
              void codeAction.run(
                () => unwrap(browserApi().POST("/v1/admin/devices/{deviceId}/provisioning-codes", path)),
                (issued) => setCode(issued),
              )
            }
          >
            {t("provisioningCode")}
          </Button>
        ) : null}
        {actions.has("revoke-certificates") ? (
          <ConfirmAction
            label={t("revoke")}
            icon={IconKey}
            variant="destructive"
            tone="destructive"
            testId="revoke-certificates"
            title={t("revokeTitle", { serial: device.serial })}
            description={t("revokeBody")}
            confirmLabel={t("revoke")}
            phrase={device.serial}
            ready={reason.trim().length > 0}
            successMessage={t("revoked")}
            onConfirm={(key) =>
              unwrap(
                browserApi().POST("/v1/admin/devices/{deviceId}/actions/revoke-certificates", {
                  params: { path: { deviceId: device.id }, header: { "Idempotency-Key": key } },
                  body: { reason: reason.trim(), incidentRef: incident.trim() || null },
                }),
              )
            }
          >
            {reasonFields("revoke")}
          </ConfirmAction>
        ) : null}
        {actions.has("retire") ? (
          <ConfirmAction
            label={t("retire")}
            icon={IconRemove}
            variant="destructive"
            tone="destructive"
            testId="retire-device"
            title={t("retireTitle", { serial: device.serial })}
            description={t("retireBody")}
            confirmLabel={t("retire")}
            phrase={device.serial}
            ready={reason.trim().length > 0}
            successMessage={t("retired")}
            onConfirm={(key) =>
              unwrap(
                browserApi().POST("/v1/admin/devices/{deviceId}/actions/retire", {
                  params: { path: { deviceId: device.id }, header: { "Idempotency-Key": key } },
                  body: { reason: reason.trim(), incidentRef: incident.trim() || null },
                }),
              )
            }
          >
            {reasonFields("retire")}
          </ConfirmAction>
        ) : null}
      </div>
      <ProblemNotice error={codeAction.error} />
      {code ? (
        <Callout tone="info" icon={IconLock} title={t("codeTitle")}>
          <p>
            <strong className="font-mono text-lg" data-testid="provisioning-code-value">
              {code.code}
            </strong>
          </p>
          <p className="text-sm">{t("codeHint", { date: formatDateTime(code.expiresAt, locale) })}</p>
        </Callout>
      ) : null}
    </div>
  );
}
