import { getTranslations } from "next-intl/server";

import { RealtimeProvider } from "@/features/shared/realtime/RealtimeProvider";
import { entitledMenu } from "@/features/shared/shell/menu";
import { groupItems } from "@/features/shared/shell/types";
import { createApiClient, unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

import { AdminShellFrame } from "./AdminShellFrame";
import { ADMIN_MENU, ADMIN_MENU_GROUPS } from "./menu";

async function systemInfo(): Promise<Schemas["SystemInfoDto"] | null> {
  try {
    const edge = await inboundEdgeHeaders();
    return await unwrap(
      createApiClient({ baseUrl: serverEnv().API_INTERNAL_URL, headers: () => edge }).GET("/v1/admin/system/info"),
    );
  } catch {
    return null;
  }
}

/** Server half of the admin shell: menu from `/v1/admin/me`, the API's environment and fakes flag. */
export async function AdminShell({ me, children }: { me: Schemas["AdminMeDto"]; children: React.ReactNode }) {
  const t = await getTranslations();
  const items = entitledMenu(me.menu, ADMIN_MENU).map((item) => ({ ...item, label: t(`admin.nav.${item.key}`) }));
  const groups = groupItems(
    items,
    ADMIN_MENU_GROUPS,
    Object.fromEntries(ADMIN_MENU_GROUPS.map((group) => [group, t(`admin.nav.group.${group}`)])),
  );
  const info = await systemInfo();
  const envBadge =
    clientEnv().NEXT_PUBLIC_ENV_BADGE ?? (info && info.environment !== "production" ? info.environment : undefined);
  return (
    <RealtimeProvider zone="admin" tenantId={null}>
      <AdminShellFrame
        userName={me.user.displayName}
        rolesLabel={me.roles.map((role) => t(`glossary.platformRole.${role}`)).join(", ")}
        groups={groups}
        envBadge={envBadge}
        apiFakes={info?.fakes ?? false}
        fakesLabel={t("admin.shell.fakes")}
      >
        {children}
      </AdminShellFrame>
    </RealtimeProvider>
  );
}
