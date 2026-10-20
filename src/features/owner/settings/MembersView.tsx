import { getTranslations } from "next-intl/server";

import { INVITATION_STATUS } from "@/domain/status/invitation";
import { MEMBERSHIP_STATUS } from "@/domain/status/membership";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { EditMember, InviteMember, RemoveMember, RevokeInvitation } from "./MemberActions";
import { SettingsNav } from "./SettingsNav";

/**
 * Members & roles (F2 2.6, D-090): the people working for the tenant with their role (owner, manager,
 * accountant, staff), the buildings they are limited to and their status; pending invitations with
 * revoke; invite, change and remove for those who may.
 */
export async function MembersView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.members");
  const roles = await getTranslations("glossary.tenantRole");
  const { api, locale, me, buildings } = context;
  const [members, invitations] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/members"))),
    section(unwrap(api.GET("/v1/owner/invitations"))),
  ]);
  const writable = !readOnly(me);
  const invite = ownerCan(me, "tenant.member.invite") && writable;
  const manage = ownerCan(me, "tenant.member.manage") && writable;
  const options = buildings.map((building) => ({ id: building.id, name: building.name }));
  const buildingNames = (ids: unknown) =>
    Array.isArray(ids) && ids.length
      ? ids.map((id) => buildings.find((b) => b.id === id)?.name ?? String(id).slice(0, 8)).join(", ")
      : t("allBuildings");
  return (
    <OwnerPage testId="members">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={invite ? <InviteMember buildings={options} /> : null}
      />
      <SettingsNav me={me} current="/settings/members" locale={locale} />
      {!members.data ? (
        <SectionError error={members.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="member-table"
          minWidth="56rem"
          columns={[
            { key: "name", header: t("col.name") },
            { key: "role", header: t("col.role") },
            { key: "buildings", header: t("col.buildings") },
            { key: "joined", header: t("col.joined") },
            { key: "status", header: t("col.status") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={members.data
            .filter((member) => member.status !== "removed")
            .map((member) => ({
              key: member.id,
              testId: "member-row",
              data: { role: member.role, status: member.status },
              cells: {
                name: (
                  <span className="flex flex-col">
                    <span className="font-semibold">{member.displayName}</span>
                    <span className="text-muted text-xs">
                      {[member.phone ? formatPhone(member.phone) : null, member.email].filter(Boolean).join(" · ") ||
                        "—"}
                    </span>
                  </span>
                ),
                role: roles(member.role),
                buildings: buildingNames(member.buildingIds),
                joined: member.joinedAt ? formatDateTime(member.joinedAt, locale) : "—",
                status: <StatusBadgeOf map={MEMBERSHIP_STATUS} value={member.status} size="sm" />,
                actions:
                  manage && member.userId !== me.user.id ? (
                    <span className="flex flex-wrap gap-2">
                      <EditMember member={member} buildings={options} />
                      <RemoveMember member={member} />
                    </span>
                  ) : null,
              },
            }))}
        />
      )}
      <Card as="section" aria-labelledby="members-invitations">
        <CardHeader
          title={<span id="members-invitations">{t("invitations")}</span>}
          description={t("invitationsHint")}
        />
        {!invitations.data ? (
          <SectionError error={invitations.error} />
        ) : invitations.data.length === 0 ? (
          <EmptyState title={t("noInvitations")} />
        ) : (
          <SimpleTable
            caption={t("invitations")}
            testId="invitation-table"
            minWidth="48rem"
            columns={[
              { key: "to", header: t("col.to") },
              { key: "role", header: t("col.role") },
              { key: "expires", header: t("col.expires") },
              { key: "state", header: t("col.status") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={invitations.data.map((invitation) => ({
              key: invitation.id,
              testId: "invitation-row",
              data: { state: invitation.state },
              cells: {
                to: (
                  <span className="flex flex-col">
                    <span>{invitation.phoneMasked ?? invitation.email ?? "—"}</span>
                    <span className="text-muted text-xs">{t(`channelName.${invitation.channel}`)}</span>
                  </span>
                ),
                role: roles(invitation.role),
                expires: formatDateTime(invitation.expiresAt, locale),
                state: <StatusBadgeOf map={INVITATION_STATUS} value={invitation.state} size="sm" />,
                actions:
                  invitation.nextActions.includes("revoke") && writable ? (
                    <RevokeInvitation invitation={invitation} />
                  ) : null,
              },
            }))}
          />
        )}
      </Card>
    </OwnerPage>
  );
}
