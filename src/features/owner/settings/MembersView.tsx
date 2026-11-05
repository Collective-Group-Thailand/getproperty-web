import { getTranslations } from "next-intl/server";

import { INVITATION_STATUS } from "@/domain/status/invitation";
import { MEMBERSHIP_STATUS } from "@/domain/status/membership";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Avatar } from "@/ui/components/Avatar";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconMail } from "@/ui/icons/glyphs/mail";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { InvitationMenu, InviteMember, MemberMenu } from "./MemberActions";
import { isJuristicTenant } from "../shell/menu";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

/**
 * Settings › Members (F2 2.6, D-090; redesign G6): the people working for the tenant — initial, name and contact, role,
 * the buildings they are limited to, when they joined and their status — with one "⋯" per row (change role and
 * buildings · remove); the invitations under it. "เชิญสมาชิก" is the section's one filled action.
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
  // D-320: a juristic office invites its committee and a time-boxed auditor.
  const juristic = isJuristicTenant(me.currentTenant?.type);
  const roleLabel = (role: Schemas["TenantRole"], accessUntil: string | null) =>
    accessUntil ? t("roleUntil", { role: roles(role), date: formatDate(accessUntil, locale) }) : roles(role);
  const buildingNames = (ids: unknown) =>
    Array.isArray(ids) && ids.length
      ? ids
          .map((id) => buildings.find((b) => b.id === id)?.name)
          .filter(Boolean)
          .join(", ") || t("allBuildings")
      : t("allBuildings");
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/members"
      title={t("title")}
      description={t("description")}
      actions={invite ? <InviteMember buildings={options} juristic={juristic} /> : null}
      testId="members"
    >
      <SettingsCard number={1} id="members-team" title={t("team")} description={t("teamHint")} flush>
        {!members.data ? (
          <div className="p-5 md:p-6">
            <SectionError error={members.error} />
          </div>
        ) : (
          <SimpleTable
            caption={t("team")}
            testId="member-table"
            minWidth="48rem"
            stackOnPhones
            className="rounded-none border-0 shadow-none"
            columns={[
              { key: "name", header: t("col.name"), phone: "title" },
              { key: "role", header: t("col.role"), phone: "meta" },
              { key: "buildings", header: t("col.buildings"), phone: "meta" },
              { key: "joined", header: t("col.joined"), className: "whitespace-nowrap", phone: "hidden" },
              { key: "status", header: t("col.status"), className: "whitespace-nowrap", phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "figure",
              },
            ]}
            rows={members.data
              .filter((member) => member.status !== "removed")
              .map((member) => ({
                key: member.id,
                testId: "member-row",
                data: { role: member.role, status: member.status },
                cells: {
                  name: (
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={member.displayName} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{member.displayName}</span>
                        <span className="text-muted truncate text-sm tabular-nums">
                          {[member.phone ? formatPhone(member.phone) : null, member.email]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                    </span>
                  ),
                  role: <span data-testid="member-role-label">{roleLabel(member.role, member.accessUntil)}</span>,
                  buildings: buildingNames(member.buildingIds),
                  joined: member.joinedAt ? formatDate(member.joinedAt, locale) : "—",
                  status: <StatusBadgeOf map={MEMBERSHIP_STATUS} value={member.status} size="sm" />,
                  actions:
                    manage && member.userId !== me.user.id ? (
                      <MemberMenu member={member} buildings={options} juristic={juristic} />
                    ) : (
                      ""
                    ),
                },
              }))}
          />
        )}
      </SettingsCard>

      <SettingsCard
        number={2}
        id="members-invitations"
        title={t("invitations")}
        description={t("invitationsHint")}
        flush
      >
        {!invitations.data ? (
          <div className="p-5 md:p-6">
            <SectionError error={invitations.error} />
          </div>
        ) : invitations.data.length === 0 ? (
          <EmptyState
            icon={IconMail}
            title={t("noInvitations")}
            description={t("noInvitationsHint")}
            action={
              invite ? (
                <InviteMember buildings={options} testId="invite-member-empty" secondary juristic={juristic} />
              ) : null
            }
          />
        ) : (
          <SimpleTable
            caption={t("invitations")}
            testId="invitation-table"
            minWidth="44rem"
            stackOnPhones
            className="rounded-none border-0 shadow-none"
            columns={[
              { key: "to", header: t("col.to"), phone: "title" },
              { key: "role", header: t("col.role"), phone: "meta" },
              { key: "expires", header: t("col.expires"), className: "whitespace-nowrap", phone: "meta" },
              { key: "state", header: t("col.status"), className: "whitespace-nowrap", phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "figure",
              },
            ]}
            rows={invitations.data.map((invitation) => ({
              key: invitation.id,
              testId: "invitation-row",
              data: { state: invitation.state },
              cells: {
                to: (
                  <span className="flex flex-col">
                    <span className="font-medium tabular-nums">
                      {invitation.phoneMasked ?? invitation.email ?? t(`channelName.${invitation.channel}`)}
                    </span>
                    <span className="text-muted text-sm">
                      {t("sentVia", { channel: t(`channelName.${invitation.channel}`) })}
                    </span>
                  </span>
                ),
                role: roleLabel(invitation.role, invitation.accessUntil),
                expires: formatDateTime(invitation.expiresAt, locale),
                state: <StatusBadgeOf map={INVITATION_STATUS} value={invitation.state} size="sm" />,
                actions:
                  invitation.nextActions.includes("revoke") && writable ? (
                    <InvitationMenu invitation={invitation} />
                  ) : (
                    ""
                  ),
              },
            }))}
          />
        )}
      </SettingsCard>
    </SettingsFrame>
  );
}
