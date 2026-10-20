import { getTranslations } from "next-intl/server";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { can, section, type AdminContext } from "../shared/server";
import { CreatePlatformUser, GrantRole, RevokeRole } from "./OperationsActions";

/**
 * Platform users (D-090, D-164): Collective staff with their platform roles (temporary roles with their
 * end date), TOTP enrolment, status and last sign-in; create, grant and revoke for `admin.user.manage`.
 */
export async function PlatformUsersView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.operations.users");
  const roles = await getTranslations("glossary.platformRole");
  const { api, locale, me } = context;
  const users = await section(unwrap(api.GET("/v1/admin/platform-users")));
  const manage = can(me, "admin.user.manage");
  return (
    <ConsolePage testId="platform-users">
      <PageHeader title={t("title")} description={t("description")} actions={manage ? <CreatePlatformUser /> : null} />
      {!users.data ? (
        <SectionError error={users.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="user-table"
          minWidth="56rem"
          columns={[
            { key: "name", header: t("col.name") },
            { key: "roles", header: t("col.roles") },
            { key: "totp", header: t("col.totp") },
            { key: "login", header: t("col.login") },
            { key: "status", header: t("col.status") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={users.data.map((user) => ({
            key: user.id,
            testId: "user-row",
            data: { email: user.email },
            cells: {
              name: (
                <span className="flex flex-col">
                  <span className="font-semibold">{user.displayName}</span>
                  <span className="text-muted text-xs">{user.email ?? "—"}</span>
                </span>
              ),
              roles: (
                <ul className="flex flex-col gap-1">
                  {user.roles.map((held) => (
                    <li
                      key={held.role}
                      className="flex flex-wrap items-center gap-1"
                      data-testid="user-role"
                      data-role={held.role}
                    >
                      <Badge size="sm">{roles(held.role)}</Badge>
                      {held.expiresAt ? (
                        <span className="text-muted text-xs">
                          {t("until", { date: formatDate(held.expiresAt, locale) })}
                        </span>
                      ) : null}
                      {manage && user.id !== me.user.id ? <RevokeRole user={user} role={held.role} /> : null}
                    </li>
                  ))}
                </ul>
              ),
              totp: user.totpEnabled ? (
                t("totpOn")
              ) : (
                <Badge size="sm" tone="warning">
                  {t("totpOff")}
                </Badge>
              ),
              login: user.lastLoginAt ? formatDateTime(user.lastLoginAt, locale) : t("never"),
              status: t(`status.${user.status}`),
              actions: manage ? <GrantRole user={user} /> : null,
            },
          }))}
        />
      )}
    </ConsolePage>
  );
}
