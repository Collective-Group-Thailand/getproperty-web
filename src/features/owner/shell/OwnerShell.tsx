import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { ReadOnlyProvider } from "@/features/shared/providers/ReadOnlyProvider";
import { RealtimeProvider } from "@/features/shared/realtime/RealtimeProvider";
import { shellBrand } from "@/features/shared/shell/brand";
import { entitledMenu } from "@/features/shared/shell/menu";
import { ReadOnlyBanner } from "@/features/shared/shell/ReadOnlyBanner";
import { groupItems, type ShellNavItem } from "@/features/shared/shell/types";
import { unwrap } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { BUILDING_COOKIE } from "@/features/shared/shell/building";
import { OWNER_BOTTOM_NAV, OWNER_MENU, OWNER_MENU_GROUPS } from "./menu";
import { OwnerShellFrame } from "./OwnerShellFrame";

async function buildings(): Promise<Schemas["BuildingDto"][]> {
  try {
    const api = await serverApi("owner");
    return await unwrap(api.GET("/v1/owner/buildings"));
  } catch (error) {
    // The switcher is a convenience: a failure here must not take the console down.
    console.error("owner shell: buildings unavailable", error);
    return [];
  }
}

/** Server half of the owner shell: resolves the menu, labels, buildings and focus for the frame. */
export async function OwnerShell({
  me,
  locale,
  children,
}: {
  me: Schemas["OperatorMeDto"] & { currentTenant: Schemas["CurrentTenantDto"] };
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const prefix = (href: string) => getPathname({ href, locale });
  const items: ShellNavItem[] = entitledMenu(me.menu, OWNER_MENU).map((item) => ({
    ...item,
    href: prefix(item.href),
    label: t(`owner.nav.${item.key}`),
  }));
  const groups = groupItems(
    items,
    OWNER_MENU_GROUPS,
    Object.fromEntries(OWNER_MENU_GROUPS.map((group) => [group, t(`owner.nav.group.${group}`)])),
  );
  const bottomNav = OWNER_BOTTOM_NAV.flatMap(({ key, labelKey }) => {
    const item = items.find((candidate) => candidate.key === key);
    return item ? [{ item, label: t(`owner.nav.bottom.${labelKey}`) }] : [];
  });
  const [list, jar] = await Promise.all([buildings(), cookies()]);
  const focus = jar.get(BUILDING_COOKIE)?.value;
  const readOnly = me.subscription?.readOnly ?? false;
  const subscription = items.find((item) => item.key === "subscription");
  // A landlord's "buildings" are its houses and the condo stubs it shares (B7.1): the portfolio is the switch. An
  // agency (G2) works unit by unit on its mandated units: no building switcher either.
  const landlord = me.currentTenant.type === "landlord" || me.currentTenant.type === "agency";

  return (
    <ReadOnlyProvider initial={readOnly}>
      <RealtimeProvider zone="owner" tenantId={me.currentTenant.id}>
        <OwnerShellFrame
          tenants={me.tenants}
          currentTenant={me.currentTenant}
          userName={me.user.displayName}
          roleLabel={t(`glossary.tenantRole.${me.currentTenant.role}`)}
          groups={groups}
          bottomNav={bottomNav}
          buildings={landlord ? [] : list}
          currentBuildingId={!landlord && list.some((building) => building.id === focus) ? focus! : null}
          envBadge={serverEnv().NEXT_PUBLIC_ENV_BADGE}
          localePrefix={locale === "th" ? "" : `/${locale}`}
          loginHref={prefix("/login")}
          brand={shellBrand()}
          banner={readOnly ? <ReadOnlyBanner subscriptionHref={subscription?.href} /> : undefined}
        >
          {children}
        </OwnerShellFrame>
      </RealtimeProvider>
    </ReadOnlyProvider>
  );
}
