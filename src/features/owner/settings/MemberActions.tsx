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
export function InviteMember({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.settings.members");
  const roles = useTranslations("glossary.tenantRole");
  const [channel, setChannel] = useState<Schemas["InvitationChannel"]>("sms");
  const [created, setCreated] = useState<Schemas["InvitationCreatedDto"] | null>(null);
  const [phone, setPhone] = useState("");
  return (
    <div className="flex flex-col items-end gap-2">
      <FormDialog
        label={t("invite")}
        icon={IconAdd}
        variant="primary"
        testId="invite-member"
        title={t("inviteTitle")}
        description={t("inviteHint")}
        submitLabel={t("invite")}
        successMessage={t("invited")}
        onDone={(result) => setCreated(result as Schemas["InvitationCreatedDto"])}
        onSubmit={(data) => {
          const chosen = chosenBuildings(data, buildings);
          return unwrap(
            browserApi().POST("/v1/owner/invitations", {
              body: {
                role: (text(data, "role") ?? "staff") as Schemas["TenantRole"],
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
            <Field label={t("role")} required error={errors.role}>
              <NativeSelect
                name="role"
                defaultValue="staff"
                options={ROLES.map((role) => ({ value: role, label: roles(role) }))}
                data-testid="invite-role"
              />
            </Field>
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
}: {
  member: Schemas["MemberDto"];
  buildings: { id: string; name: string }[];
}) {
  const t = useTranslations("owner.settings.members");
  const roles = useTranslations("glossary.tenantRole");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      testId={`edit-member-${member.id}`}
      title={t("editTitle", { name: member.displayName })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) => {
        const chosen = chosenBuildings(data, buildings);
        return unwrap(
          browserApi().PATCH("/v1/owner/members/{membershipId}", {
            params: { path: { membershipId: member.id } },
            body: {
              role: text(data, "role") as Schemas["TenantRole"],
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
              defaultValue={member.role}
              options={ROLES.map((role) => ({ value: role, label: roles(role) }))}
              data-testid="member-role"
            />
          </Field>
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
