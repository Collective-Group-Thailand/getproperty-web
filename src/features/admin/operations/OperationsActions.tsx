"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconRemove } from "@/ui/icons/glyphs/remove";

const ROLES: Schemas["PlatformRole"][] = ["platform_admin", "support", "field_engineer", "finance"];

/**
 * Replays one dead outbox message (`…/outbox/messages/{id}/actions/replay`) or one failed subscriber
 * delivery (`…/outbox/dead-letters/{id}/actions/replay`): the event is published again exactly as
 * stored — subscribers are idempotent per event id (D-180), so a replay never doubles an effect.
 */
export function ReplayButton({
  kind,
  id,
  eventType,
}: {
  kind: "message" | "consumption";
  id: string;
  eventType: string;
}) {
  const t = useTranslations("admin.operations.outbox");
  return (
    <ConfirmAction
      label={t("replay")}
      icon={IconRefresh}
      size="sm"
      variant="secondary"
      testId={`replay-${id}`}
      title={t("replayTitle", { type: eventType })}
      description={t(kind === "message" ? "replayMessageBody" : "replayConsumptionBody", { type: eventType })}
      confirmLabel={t("replay")}
      successMessage={t("replayed")}
      onConfirm={() =>
        kind === "message"
          ? unwrap(
              browserApi().POST("/v1/admin/outbox/messages/{messageId}/actions/replay", {
                params: { path: { messageId: id } },
              }),
            )
          : unwrap(
              browserApi().POST("/v1/admin/outbox/dead-letters/{deadLetterId}/actions/replay", {
                params: { path: { deadLetterId: id } },
              }),
            )
      }
    />
  );
}

/** `POST /v1/admin/platform-users` — a Collective staff account with its roles; TOTP is enrolled at first sign-in (D-164). */
export function CreatePlatformUser() {
  const t = useTranslations("admin.operations.users");
  const roles = useTranslations("glossary.platformRole");
  return (
    <FormDialog
      label={t("create")}
      icon={IconAdd}
      variant="primary"
      testId="create-user"
      title={t("createTitle")}
      description={t("createHint")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/platform-users", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              displayName: text(data, "displayName") ?? "",
              email: text(data, "email") ?? "",
              phone: text(data, "phone"),
              roles: ROLES.filter((role) => data.get(`role:${role}`) === "on"),
              temporaryPassword: String(data.get("temporaryPassword") ?? ""),
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.displayName}>
            <Input name="displayName" required autoComplete="off" data-testid="user-name" />
          </Field>
          <Field label={t("email")} required error={errors.email}>
            <Input name="email" type="email" required autoComplete="off" data-testid="user-email" />
          </Field>
          <Field label={t("phone")} hint={t("phoneHint")} error={errors.phone}>
            <Input name="phone" type="tel" autoComplete="off" />
          </Field>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium">{t("roles")}</legend>
            {ROLES.map((role) => (
              <Checkbox key={role} name={`role:${role}`} label={roles(role)} data-testid={`user-role-${role}`} />
            ))}
            {errors.roles ? <p className="text-sm">{errors.roles}</p> : null}
          </fieldset>
          <Field
            label={t("temporaryPassword")}
            hint={t("temporaryPasswordHint")}
            required
            error={errors.temporaryPassword}
          >
            <Input
              name="temporaryPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              data-testid="user-password"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** `POST /v1/admin/platform-users/{id}/roles` — another role, optionally until a date (a temporary grant). */
export function GrantRole({ user }: { user: Schemas["PlatformUserDto"] }) {
  const t = useTranslations("admin.operations.users");
  const roles = useTranslations("glossary.platformRole");
  const missing = ROLES.filter((role) => !user.roles.some((held) => held.role === role));
  if (missing.length === 0) return null;
  return (
    <FormDialog
      label={t("grant")}
      icon={IconKey}
      size="sm"
      testId={`grant-${user.id}`}
      title={t("grantTitle", { name: user.displayName })}
      submitLabel={t("grant")}
      successMessage={t("granted")}
      onSubmit={(data) => {
        const until = text(data, "expiresAt");
        return unwrap(
          browserApi().POST("/v1/admin/platform-users/{userId}/roles", {
            params: { path: { userId: user.id } },
            body: {
              role: (text(data, "role") ?? missing[0]) as Schemas["PlatformRole"],
              expiresAt: until ? new Date(`${until}T23:59:59+07:00`).toISOString() : null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("role")} required error={errors.role}>
            <NativeSelect
              name="role"
              options={missing.map((role) => ({ value: role, label: roles(role) }))}
              data-testid="grant-role"
            />
          </Field>
          <Field label={t("expiresAt")} hint={t("expiresAtHint")} error={errors.expiresAt}>
            <Input name="expiresAt" type="date" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** `DELETE /v1/admin/platform-users/{id}/roles/{role}` — typed: the person's email (or name) restated. */
export function RevokeRole({ user, role }: { user: Schemas["PlatformUserDto"]; role: Schemas["PlatformRole"] }) {
  const t = useTranslations("admin.operations.users");
  const roles = useTranslations("glossary.platformRole");
  const [phrase] = useState(user.email ?? user.displayName);
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconRemove}
      size="sm"
      variant="ghost"
      tone="destructive"
      testId={`revoke-${user.id}-${role}`}
      title={t("revokeTitle", { role: roles(role), name: user.displayName })}
      description={t("revokeBody")}
      confirmLabel={t("revoke")}
      phrase={phrase}
      successMessage={t("revoked")}
      onConfirm={() =>
        unwrap(
          browserApi().DELETE("/v1/admin/platform-users/{userId}/roles/{role}", {
            params: { path: { userId: user.id, role } },
          }),
        )
      }
    />
  );
}
