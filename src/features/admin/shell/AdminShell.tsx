import { getTranslations } from "next-intl/server";

import { RealtimeProvider } from "@/features/shared/realtime/RealtimeProvider";
import { shellBrand } from "@/features/shared/shell/brand";
import { entitledMenu } from "@/features/shared/shell/menu";
import { groupItems } from "@/features/shared/shell/types";
import { createApiClient, unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

import { tenantSections } from "../tenants/sections";
import { AdminShellFrame } from "./AdminShellFrame";
import { ADMIN_HOME, ADMIN_MENU, ADMIN_MENU_GROUPS, childAllowed } from "./menu";

/** The column's order is the registry's (customers → platform → operations, the queue order of the work). */
const ORDER = Object.keys(ADMIN_MENU);

export async function systemInfo(): Promise<Schemas["SystemInfoDto"] | null> {
  try {
    const edge = await inboundEdgeHeaders();
    return await unwrap(
      createApiClient({ baseUrl: serverEnv().API_INTERNAL_URL, headers: () => edge }).GET("/v1/admin/system/info"),
    );
  } catch {
    return null;
  }
}

/** The environment badge (never in production) and the API's fakes flag — the column and the sign-in card show them. */
export async function adminEnvironment(): Promise<{ info: Schemas["SystemInfoDto"] | null; envBadge?: string }> {
  const info = await systemInfo();
  const envBadge =
    serverEnv().NEXT_PUBLIC_ENV_BADGE ?? (info && info.environment !== "production" ? info.environment : undefined);
  return { info, envBadge };
}

/** Server half of the admin shell: menu from `/v1/admin/me`, the API's environment and fakes flag. */
export async function AdminShell({ me, children }: { me: Schemas["AdminMeDto"]; children: React.ReactNode }) {
  const t = await getTranslations();
  const items = [
    { key: "home", ...ADMIN_HOME },
    ...entitledMenu(me.menu, ADMIN_MENU).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)),
  ].map((item) => ({
    ...item,
    label: t(`admin.nav.${item.key}` as Parameters<typeof t>[0]),
    // A section's own pages (subscriptions, listings) in the column instead of a row of tabs (redesign G8).
    children: item.children
      ?.filter((child) => childAllowed(me, child.key))
      .map((child) => ({
        key: child.key,
        href: child.href,
        label: t(child.label as Parameters<typeof t>[0]),
        testId: child.testId,
      })),
  }));
  const sections = tenantSections(me).map((key) => ({ key, label: t(`admin.tenants.tab.${key}`) }));
  const groups = groupItems(
    items,
    ADMIN_MENU_GROUPS,
    Object.fromEntries(ADMIN_MENU_GROUPS.map((group) => [group, t(`admin.nav.group.${group}`)])),
  );
  const { info, envBadge } = await adminEnvironment();
  return (
    <RealtimeProvider zone="admin" tenantId={null}>
      <AdminShellFrame
        userName={me.user.displayName}
        zoneLabel={t("admin.shell.zone")}
        rolesLabel={me.roles.map((role) => t(`glossary.platformRole.${role}`)).join(", ")}
        groups={groups}
        envBadge={envBadge}
        apiFakes={info?.fakes ?? false}
        fakesLabel={t("admin.shell.fakes")}
        brand={shellBrand()}
        tenantSections={sections}
        recordLabels={{ back: t("admin.nav.tenants"), nav: t("admin.tenants.tabsLabel") }}
      >
        {children}
      </AdminShellFrame>
    </RealtimeProvider>
  );
}
