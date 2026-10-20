"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant, bangkokLocal } from "@/features/shared/console/time";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
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
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconUnlock } from "@/ui/icons/glyphs/unlock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import type { FieldMember } from "../shared/members";

const SCOPES: Schemas["LockScope"][] = ["unit", "building_door", "common_area"];
const VENDORS: Schemas["LockVendor"][] = ["ttlock", "tuya", "hikvision", "zkteco", "other"];

/** Registers a lock of the building (D-070): a unit lock gets the lessee's code at once when the unit is leased. */
export function RegisterLock({ buildingId, units }: { buildingId: string; units: { id: string; unitNo: string }[] }) {
  const t = useTranslations("owner.access.register");
  const [scope, setScope] = useState<Schemas["LockScope"]>("unit");
  return (
    <FormDialog
      label={t("action")}
      icon={IconAdd}
      variant="primary"
      testId="lock-register"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/locks", {
            body: {
              name: text(data, "name") ?? "",
              scope,
              vendor: (text(data, "vendor") ?? "ttlock") as Schemas["LockVendor"],
              serial: text(data, "serial") ?? "",
              vendorLockId: text(data, "vendorLockId") ?? "",
              model: text(data, "model") ?? null,
              unitId: scope === "unit" ? (text(data, "unitId") ?? null) : null,
              buildingId,
            },
          }),
        )
      }
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" required data-testid="lock-name" />
          </Field>
          <Field label={t("scope")} error={errors.scope}>
            <NativeSelect
              value={scope}
              onChange={(event) => setScope(event.target.value as Schemas["LockScope"])}
              options={SCOPES.map((value) => ({ value, label: t(`scopes.${value}`) }))}
              data-testid="lock-scope"
            />
          </Field>
          {scope === "unit" ? (
            <Field label={t("unit")} required error={errors.unitId}>
              <NativeSelect
                name="unitId"
                required
                placeholder={t("chooseUnit")}
                options={units.map((unit) => ({ value: unit.id, label: unit.unitNo }))}
                data-testid="lock-unit"
              />
            </Field>
          ) : null}
          <Field label={t("vendor")} error={errors.vendor}>
            <NativeSelect
              name="vendor"
              defaultValue="ttlock"
              options={VENDORS.map((value) => ({ value, label: t(`vendors.${value}`) }))}
            />
          </Field>
          <Field label={t("serial")} required error={errors.serial}>
            <Input name="serial" required className="font-mono" data-testid="lock-serial" />
          </Field>
          <Field label={t("vendorLockId")} hint={t("vendorLockIdHint")} required error={errors.vendorLockId}>
            <Input name="vendorLockId" required className="font-mono" data-testid="lock-vendor-id" />
          </Field>
          <Field label={t("model")} error={errors.model}>
            <Input name="model" />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/** Refresh from the vendor (battery, log) and take the lock in or out of use. */
export function LockControls({ lock }: { lock: Pick<Schemas["LockDto"], "id" | "name" | "isActive"> }) {
  const t = useTranslations("owner.access.lock");
  const refresh = useApiAction();
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          iconStart={IconRefresh}
          loading={refresh.busy}
          data-testid="lock-refresh"
          onClick={() =>
            void refresh.run(() =>
              unwrap(
                browserApi().POST("/v1/owner/locks/{lockId}/actions/refresh", {
                  params: { path: { lockId: lock.id } },
                }),
              ),
            )
          }
        >
          {t("refresh")}
        </Button>
        <ConfirmAction
          label={lock.isActive ? t("deactivate") : t("activate")}
          icon={lock.isActive ? IconLock : IconUnlock}
          variant="secondary"
          testId="lock-active"
          title={lock.isActive ? t("deactivateTitle", { name: lock.name }) : t("activateTitle", { name: lock.name })}
          description={lock.isActive ? t("deactivateBody") : t("activateBody")}
          confirmLabel={lock.isActive ? t("deactivate") : t("activate")}
          successMessage={t("saved")}
          onConfirm={() =>
            unwrap(
              browserApi().PATCH("/v1/owner/locks/{lockId}", {
                params: { path: { lockId: lock.id } },
                body: { isActive: !lock.isActive },
              }),
            )
          }
        />
      </div>
      <ProblemNotice error={refresh.error} />
    </div>
  );
}

/**
 * Ends one credential with a reason (D-071): typed confirmation restating the holder and the lock; a
 * resident is told on LINE. Access follows the lease — this is an owner decision, never a collection step
 * (D-024): nothing here knows about invoices or balances.
 */
export function RevokeCredential({
  credential,
}: {
  credential: Pick<Schemas["CredentialDto"], "id" | "holderName" | "holderKind" | "lockName" | "unitNo">;
}) {
  const t = useTranslations("owner.access.revoke");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("action")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="credential-revoke"
      title={t("title", { holder: credential.holderName, lock: credential.lockName })}
      description={credential.holderKind === "resident" ? t("bodyResident") : t("body")}
      confirmLabel={t("action")}
      phrase={credential.unitNo ?? credential.holderName}
      ready={reason.trim().length > 0}
      successMessage={t("done")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/access-credentials/{credentialId}/actions/revoke", {
            params: { path: { credentialId: credential.id } },
            body: { reason: reason.trim() },
          }),
        )
      }
    >
      <Field label={t("reason")} hint={credential.holderKind === "resident" ? t("reasonHint") : undefined} required>
        <Textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid="revoke-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/** The PIN of a code just issued — shown once, to the issuer (D-211); it cannot be read again. */
function IssuedPin({ issued, onHide }: { issued: Schemas["IssuedCredentialDto"]; onHide: () => void }) {
  const t = useTranslations("owner.access.code");
  const locale = useLocale() as Locale;
  return (
    <Callout tone="info" title={t("issuedTitle", { holder: issued.holderName })}>
      <p className="font-mono text-3xl tracking-widest" data-testid="issued-pin">
        {issued.pin}
      </p>
      <p className="mt-1 text-sm">
        {t("issuedWindow", {
          from: formatDateTime(issued.validFrom, locale),
          until: issued.validTo ? formatDateTime(issued.validTo, locale) : "—",
        })}
      </p>
      <p className="mt-1 text-sm">{t("issuedOnce")}</p>
      <Button className="mt-2" size="sm" variant="secondary" onClick={onHide} data-testid="issued-hide">
        {t("hide")}
      </Button>
    </Callout>
  );
}

/**
 * Time-boxed codes the owner issues on a lock (D-211): a visitor (name) or a staff member, from / until
 * (≤ 31 days, Bangkok time). One Idempotency-Key per dialog; the PIN is shown once.
 */
export function IssueCodes({ lockId, members }: { lockId: string; members: FieldMember[] }) {
  const t = useTranslations("owner.access.code");
  const [issued, setIssued] = useState<Schemas["IssuedCredentialDto"] | null>(null);
  const visitorKey = useIdempotencyKey();
  const staffKey = useIdempotencyKey();
  const [from] = useState(() => bangkokLocal(new Date().toISOString()));
  const [until] = useState(() => bangkokLocal(new Date(Date.now() + 4 * 3_600_000).toISOString()));
  const windowFields = (errors: Record<string, string>) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("from")} hint={t("bangkokTime")} required error={errors.validFrom}>
        <Input type="datetime-local" name="validFrom" required defaultValue={from} data-testid="code-from" />
      </Field>
      <Field label={t("until")} hint={t("max")} required error={errors.validTo}>
        <Input type="datetime-local" name="validTo" required defaultValue={until} data-testid="code-until" />
      </Field>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <FormDialog
          label={t("visitor")}
          icon={IconKey}
          testId="code-visitor"
          title={t("visitorTitle")}
          description={t("visitorBody")}
          submitLabel={t("issue")}
          successMessage={t("issued")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/locks/{lockId}/visitor-codes", {
                params: { path: { lockId }, header: { "Idempotency-Key": visitorKey.key } },
                body: {
                  visitorName: text(data, "visitorName") ?? "",
                  validFrom: bangkokInstant(text(data, "validFrom")) ?? "",
                  validTo: bangkokInstant(text(data, "validTo")) ?? "",
                },
              }),
            )
          }
          onDone={(result) => {
            visitorKey.renew();
            setIssued(result as Schemas["IssuedCredentialDto"]);
          }}
        >
          {(errors) => (
            <>
              <Field label={t("visitorName")} required error={errors.visitorName}>
                <Input name="visitorName" required data-testid="code-visitor-name" />
              </Field>
              {windowFields(errors)}
            </>
          )}
        </FormDialog>
        <FormDialog
          label={t("staff")}
          icon={IconStaff}
          testId="code-staff"
          title={t("staffTitle")}
          description={t("staffBody")}
          submitLabel={t("issue")}
          successMessage={t("issued")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/locks/{lockId}/staff-codes", {
                params: { path: { lockId }, header: { "Idempotency-Key": staffKey.key } },
                body: {
                  userId: text(data, "userId") ?? "",
                  validFrom: bangkokInstant(text(data, "validFrom")) ?? "",
                  validTo: bangkokInstant(text(data, "validTo")) ?? "",
                },
              }),
            )
          }
          onDone={(result) => {
            staffKey.renew();
            setIssued(result as Schemas["IssuedCredentialDto"]);
          }}
        >
          {(errors) => (
            <>
              <Field label={t("member")} required error={errors.userId}>
                <NativeSelect
                  name="userId"
                  required
                  placeholder={t("chooseMember")}
                  options={members.map((member) => ({ value: member.userId, label: member.displayName }))}
                  data-testid="code-staff-member"
                />
              </Field>
              {windowFields(errors)}
            </>
          )}
        </FormDialog>
      </div>
      {issued ? <IssuedPin issued={issued} onHide={() => setIssued(null)} /> : null}
    </div>
  );
}
