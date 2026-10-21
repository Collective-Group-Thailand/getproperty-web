import { getTranslations } from "next-intl/server";

import { ReadOnlyProvider } from "@/features/shared/providers/ReadOnlyProvider";
import { RealtimeProvider } from "@/features/shared/realtime/RealtimeProvider";
import { entitledMenu } from "@/features/shared/shell/menu";
import { ReadOnlyBanner } from "@/features/shared/shell/ReadOnlyBanner";
import { createApiClient, unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

import { DeviceLock } from "../lock/DeviceLock";
import { ServiceWorkerRegistrar } from "../pwa/ServiceWorkerRegistrar";
import { STAFF_BOTTOM_NAV, STAFF_MENU } from "./menu";
import { StaffShellFrame } from "./StaffShellFrame";

let vapidCache: { key: string | undefined; at: number } | undefined;

/** The VAPID key from the environment, else from the API's public endpoint (cached for an hour). */
async function vapidPublicKey(): Promise<string | undefined> {
  const configured = clientEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (configured) return configured;
  if (vapidCache && Date.now() - vapidCache.at < 3_600_000) return vapidCache.key;
  try {
    const edge = await inboundEdgeHeaders();
    const api = createApiClient({ baseUrl: serverEnv().API_INTERNAL_URL, headers: () => edge });
    const { publicKey } = await unwrap(api.GET("/v1/auth/web-push/public-key"));
    vapidCache = { key: publicKey, at: Date.now() };
  } catch {
    vapidCache = { key: undefined, at: Date.now() };
  }
  return vapidCache.key;
}

/** Server half of the staff shell: entitled work menus in bottom-nav order, labels, push key. */
export async function StaffShell({
  me,
  children,
}: {
  me: Schemas["StaffMeDto"] & { currentTenant: Schemas["CurrentTenantDto"] };
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const entitled = entitledMenu(me.menu, STAFF_MENU);
  const ordered = [
    ...STAFF_BOTTOM_NAV.flatMap((key) => entitled.filter((item) => item.key === key)),
    ...entitled.filter((item) => !(STAFF_BOTTOM_NAV as readonly string[]).includes(item.key)),
  ].map((item) => ({ ...item, label: t(`staff.nav.${item.key}`) }));
  const readOnly = me.subscription?.readOnly ?? false;

  return (
    <ReadOnlyProvider initial={readOnly}>
      <RealtimeProvider zone="staff" tenantId={me.currentTenant.id}>
        <DeviceLock loginHref="/login">
          <ServiceWorkerRegistrar enabled={process.env.NODE_ENV === "production"} />
          <StaffShellFrame
            userId={me.user.id}
            tenants={me.tenants}
            currentTenant={me.currentTenant}
            userName={me.user.displayName}
            roleLabel={t(`glossary.tenantRole.${me.currentTenant.role}`)}
            items={ordered}
            todayLabel={t("staff.nav.today")}
            envBadge={clientEnv().NEXT_PUBLIC_ENV_BADGE}
            vapidPublicKey={await vapidPublicKey()}
            banner={readOnly ? <ReadOnlyBanner /> : undefined}
          >
            {children}
          </StaffShellFrame>
        </DeviceLock>
      </RealtimeProvider>
    </ReadOnlyProvider>
  );
}
