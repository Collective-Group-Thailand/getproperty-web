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
import {
  isJuristicTenant,
  JURISTIC_BOTTOM_NAV,
  PM_BOTTOM_NAV,
  isPmCompany,
  JURISTIC_LABEL_KEYS,
  JURISTIC_MENU_GROUPS,
  juristicLayout,
  OWNER_BOTTOM_NAV,
  OWNER_MENU,
  OWNER_MENU_GROUPS,
  SETTINGS_SECTION_KEYS,
} from "./menu";
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
  // One "ตั้งค่า" entry for the settings frame's sections (G6) when the member opens the settings at all.
  const menu = me.menu.includes("settings") ? me.menu.filter((key) => !SETTINGS_SECTION_KEYS.has(key)) : me.menu;
  // A juristic office (pack J): the rail of J-DESIGN §5 — its own four groups, its order, the overview as "เช้านี้".
  const juristic = isJuristicTenant(me.currentTenant.type);
  const entitled: ShellNavItem[] = entitledMenu(menu, OWNER_MENU).map((item) => ({
    ...item,
    href: prefix(item.href),
    label:
      juristic && JURISTIC_LABEL_KEYS.has(item.key)
        ? t(`owner.nav.juristicLabel.${item.key as "parties"}`)
        : t(`owner.nav.${item.key}`),
    children: item.children?.map((child) => ({
      key: child.key,
      href: prefix(child.href),
      // Full message keys from the registry (`owner.common.money.tab.billing` …), typed there.
      label: t(child.label as Parameters<typeof t>[0]),
      testId: child.testId,
    })),
  }));
  const items = juristic ? juristicLayout(entitled, prefix) : entitled;
  const groups = juristic
    ? groupItems(
        items,
        JURISTIC_MENU_GROUPS,
        Object.fromEntries(JURISTIC_MENU_GROUPS.map((group) => [group, t(`owner.nav.juristicGroup.${group}`)])),
      )
    : groupItems(
        items,
        OWNER_MENU_GROUPS,
        Object.fromEntries(OWNER_MENU_GROUPS.map((group) => [group, t(`owner.nav.group.${group}`)])),
      );
  const pm = isPmCompany(me.currentTenant.type, menu);
  const bottomNav = (juristic ? JURISTIC_BOTTOM_NAV : pm ? PM_BOTTOM_NAV : OWNER_BOTTOM_NAV).flatMap(
    ({ key, labelKey }) => {
      const item = items.find((candidate) => candidate.key === key);
      return item ? [{ item, label: t(`owner.nav.bottom.${labelKey}`) }] : [];
    },
  );
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
