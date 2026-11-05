"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PhoneInput, toE164 } from "@/ui/components/PhoneInput";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

const ROLES: Schemas["TenantRole"][] = ["owner", "manager", "accountant", "staff"];
/** D-320: a juristic tenant's committee (approves budgets, adopts resolutions) and time-boxed auditor. */
const JURISTIC_ROLES: Schemas["TenantRole"][] = ["committee", "auditor"];
const rolesFor = (juristic: boolean) => (juristic ? [...ROLES, ...JURISTIC_ROLES] : ROLES);

/** The end of an auditor's access: the chosen day, to its last second in Bangkok (the API stores an instant). */
export function accessUntilInstant(day: string | undefined): string | undefined {
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T23:59:59+07:00` : undefined;
}

/** An auditor's access end date (required, D-320; at most `juristic.auditor_max_days` ahead — the API checks). */
function AccessUntilField({ defaultValue, error }: { defaultValue?: string | null; error?: string }) {
  const t = useTranslations("owner.settings.members");
  return (
    <Field label={t("accessUntil")} hint={t("accessUntilHint")} required error={error}>
      <div className="max-w-64" data-testid="access-until">
        <DateField name="accessUntil" defaultValue={defaultValue ? defaultValue.slice(0, 10) : null} />
      </div>
    </Field>
  );
}
const CHANNELS: Schemas["InvitationChannel"][] = ["sms", "email", "link", "line_qr"];

function BuildingChoice({
  buildings,
  selected,
}: {
  buildings: { id: string; name: string }[];
  selected: string[] | null;
}) {
  const t = useTranslations("owner.settings.members");
  if (buildings.length < 2) return null;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{t("buildings")}</legend>
      <p className="text-muted text-sm">{t("buildingsHint")}</p>
      {buildings.map((building) => (
        <Checkbox
          key={building.id}
          name={`building:${building.id}`}
          label={building.name}
          defaultChecked={selected?.includes(building.id) ?? false}
        />
      ))}
    </fieldset>
  );
}

const chosenBuildings = (data: FormData, buildings: { id: string }[]) =>
  buildings.filter((building) => data.get(`building:${building.id}`) === "on").map((building) => building.id);

/**
 * `POST /v1/owner/invitations` — a person joins the tenant with a role (D-090), limited to some buildings
 * or all; by SMS, email, a link or a LINE QR. The answer carries the code and the link to hand over.
 */
export function InviteMember({
  buildings,
  testId = "invite-member",
  secondary = false,
  juristic = false,
}: {
  buildings: { id: string; name: string }[];
  testId?: string;
  /** Outlined, where the page head already carries the filled one. */
  secondary?: boolean;
  /** A juristic tenant: committee and auditor roles too (D-320). */
  juristic?: boolean;
}) {
  const t = useTranslations("owner.settings.members");
  const roles = useTranslations("glossary.tenantRole");
  const [role, setRole] = useState<Schemas["TenantRole"]>("staff");
  const [channel, setChannel] = useState<Schemas["InvitationChannel"]>("sms");
  const [created, setCreated] = useState<Schemas["InvitationCreatedDto"] | null>(null);
  const [phone, setPhone] = useState("");
  return (
    <div className="flex flex-col items-end gap-2">
      <FormDialog
        label={t("invite")}
        icon={IconAdd}
        variant={secondary ? "secondary" : "primary"}
        testId={testId}
        title={t("inviteTitle")}
        description={t("inviteHint")}
        submitLabel={t("invite")}
        successMessage={t("invited")}
        onDone={(result) => setCreated(result as Schemas["InvitationCreatedDto"])}
        onSubmit={(data) => {
          const chosen = chosenBuildings(data, buildings);
          const accessUntil = role === "auditor" ? accessUntilInstant(text(data, "accessUntil")) : undefined;
          if (role === "auditor" && !accessUntil) invalidField("accessUntil", t("accessUntilRequired"));
          return unwrap(
            browserApi().POST("/v1/owner/invitations", {
              body: {
                role,
                ...(accessUntil ? { accessUntil } : {}),
                channel,
                phone: channel === "sms" ? (toE164(phone) ?? undefined) : undefined,
                email: channel === "email" ? text(data, "email") : undefined,
                buildingIds: chosen.length ? chosen : undefined,
              },
            }),
          );
        }}
      >
        {(errors) => (
          <>
            <Field label={t("role")} hint={juristic ? t(`roleHint.${role}`) : undefined} required error={errors.role}>
              <NativeSelect
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Schemas["TenantRole"])}
                options={rolesFor(juristic).map((value) => ({ value, label: roles(value) }))}
                data-testid="invite-role"
              />
            </Field>
            {role === "auditor" ? <AccessUntilField error={errors.accessUntil} /> : null}
            <Field label={t("channel")} required error={errors.channel}>
              <NativeSelect
                name="channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value as Schemas["InvitationChannel"])}
                options={CHANNELS.map((value) => ({ value, label: t(`channelName.${value}`) }))}
                data-testid="invite-channel"
              />
            </Field>
            {channel === "sms" ? (
              <Field label={t("phone")} required error={errors.phone}>
                <PhoneInput name="phone" value={phone} onChange={setPhone} />
              </Field>
            ) : null}
            {channel === "email" ? (
              <Field label={t("email")} required error={errors.email}>
                <Input name="email" type="email" required data-testid="invite-email" />
              </Field>
            ) : null}
            <BuildingChoice buildings={buildings} selected={null} />
          </>
        )}
      </FormDialog>
      {created ? (
        <Callout tone="success" title={t("createdTitle")} className="w-full max-w-xl text-start">
          <div className="flex flex-col gap-2" data-testid="invitation-created">
            <p>
              {t("code")}:{" "}
              <strong className="font-mono" data-testid="invitation-code">
                {created.code}
              </strong>
            </p>
            <p className="font-mono text-xs break-all">{created.inviteUrl}</p>
            <Button
              size="sm"
              variant="secondary"
              iconStart={IconCopy}
              onClick={() =>
                void navigator.clipboard.writeText(created.inviteUrl).then(() => toast.success(t("copied")))
              }
            >
              {t("copy")}
            </Button>
          </div>
        </Callout>
      ) : null}
    </div>
  );
}

/** `PATCH /v1/owner/members/{id}` — role, buildings, active / suspended. */
export function EditMember({
  member,
  buildings,
  juristic = false,
}: {
  member: Schemas["MemberDto"];
  buildings: { id: string; name: string }[];
  juristic?: boolean;
}) {
  const t = useTranslations("owner.settings.members");
  const roles = useTranslations("glossary.tenantRole");
  const [role, setRole] = useState<Schemas["TenantRole"]>(member.role);
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      testId={`edit-member-${member.id}`}
      menuItem={{ label: t("editMenu") }}
      title={t("editTitle", { name: member.displayName })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) => {
        const chosen = chosenBuildings(data, buildings);
        const accessUntil = role === "auditor" ? accessUntilInstant(text(data, "accessUntil")) : undefined;
        if (role === "auditor" && !accessUntil) invalidField("accessUntil", t("accessUntilRequired"));
        return unwrap(
          browserApi().PATCH("/v1/owner/members/{membershipId}", {
            params: { path: { membershipId: member.id } },
            body: {
              role,
              ...(accessUntil ? { accessUntil } : {}),
              status: text(data, "status") as Schemas["MemberSettableStatus"],
              buildingIds: buildings.length < 2 ? undefined : chosen.length ? chosen : null,
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
              value={role}
              onChange={(event) => setRole(event.target.value as Schemas["TenantRole"])}
              options={rolesFor(juristic || JURISTIC_ROLES.includes(member.role)).map((value) => ({
                value,
                label: roles(value),
              }))}
              data-testid="member-role"
            />
          </Field>
          {role === "auditor" ? (
            <AccessUntilField defaultValue={member.accessUntil} error={errors.accessUntil} />
          ) : null}
          <Field label={t("status")} error={errors.status}>
            <NativeSelect
              name="status"
              defaultValue={member.status === "suspended" ? "suspended" : "active"}
              options={(["active", "suspended"] as const).map((value) => ({ value, label: t(`statusName.${value}`) }))}
            />
          </Field>
          <BuildingChoice buildings={buildings} selected={(member.buildingIds as string[] | null) ?? null} />
        </>
      )}
    </FormDialog>
  );
}

/** `DELETE /v1/owner/members/{id}` — typed with the person's name; their sessions end. */
export function RemoveMember({ member }: { member: Schemas["MemberDto"] }) {
  const t = useTranslations("owner.settings.members");
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconRemove}
      size="sm"
      variant="destructive"
      tone="destructive"
      testId={`remove-member-${member.id}`}
      menuItem={{ label: t("removeMenu") }}
      title={t("removeTitle", { name: member.displayName })}
      description={t("removeBody")}
      confirmLabel={t("remove")}
      phrase={member.displayName}
      successMessage={t("removed")}
      onConfirm={() =>
        unwrap(
          browserApi().DELETE("/v1/owner/members/{membershipId}", { params: { path: { membershipId: member.id } } }),
        )
      }
    />
  );
}

/** `POST /v1/owner/invitations/{id}/actions/revoke`. */
export function RevokeInvitation({ invitation }: { invitation: Schemas["InvitationDto"] }) {
  const t = useTranslations("owner.settings.members");
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconXCircle}
      size="sm"
      variant="secondary"
      testId={`revoke-invitation-${invitation.id}`}
      menuItem={{ destructive: true }}
      title={t("revokeTitle")}
      description={t("revokeBody", {
        to: invitation.phoneMasked ?? invitation.email ?? t(`channelName.${invitation.channel}`),
      })}
      confirmLabel={t("revoke")}
      successMessage={t("revoked")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/invitations/{invitationId}/actions/revoke", {
            params: { path: { invitationId: invitation.id } },
          }),
        )
      }
    />
  );
}

/** The "⋯" of a member row: change role and buildings · remove from the team (red, last). */
export function MemberMenu({
  member,
  buildings,
  juristic = false,
}: {
  member: Schemas["MemberDto"];
  buildings: { id: string; name: string }[];
  juristic?: boolean;
}) {
  const t = useTranslations("owner.settings.members");
  return (
    <ActionMenu label={t("menu", { name: member.displayName })} testId={`member-menu-${member.id}`}>
      <EditMember member={member} buildings={buildings} juristic={juristic} />
      <RemoveMember member={member} />
    </ActionMenu>
  );
}

/** The "⋯" of a pending invitation: revoke it. */
export function InvitationMenu({ invitation }: { invitation: Schemas["InvitationDto"] }) {
  const t = useTranslations("owner.settings.members");
  return (
    <ActionMenu label={t("invitationMenu")} testId={`invitation-menu-${invitation.id}`}>
      <RevokeInvitation invitation={invitation} />
    </ActionMenu>
  );
}
