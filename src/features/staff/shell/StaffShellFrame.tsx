"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { NotificationCentre } from "@/features/shared/notifications/NotificationCentre";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { isActive } from "@/features/shared/shell/menu";
import { TenantSwitcher } from "@/features/shared/shell/TenantSwitcher";
import type { ShellNavItem } from "@/features/shared/shell/types";
import { UserMenu } from "@/features/shared/shell/UserMenu";
import type { Schemas } from "@/lib/api/types";
import { setQueueIdentity } from "@/lib/pwa/queue";
import { AppShell, BottomNav, TopBar, type NavItem } from "@/ui/components/AppShell";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { Icon } from "@/ui/icons";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconMore } from "@/ui/icons/glyphs/more";
import { LazyAlertDialog, LazySheet } from "@/ui/components/overlays";

import { useDeviceLock } from "../lock/DeviceLock";
import { OfflineBanner } from "../pwa/OfflineBanner";
import { PushPrompt } from "../pwa/PushPrompt";
import { SyncCenter } from "../pwa/SyncCenter";
import { BuildingSelect } from "../shared/BuildingSelect";
import { staffInnerRoute } from "./routes";

export interface StaffShellFrameProps {
  /** The signed-in staff member: the offline queue binds what it holds to them and the tenant (review M3). */
  userId: string;
  tenants: Schemas["OperatorTenantDto"][];
  currentTenant: Schemas["CurrentTenantDto"];
  userName: string;
  roleLabel: string;
  /** Today + the entitled work menus, in bottom-nav order. */
  items: ShellNavItem[];
  todayLabel: string;
  /** The buildings of my scope and the focused one: the top bar's switcher. */
  buildings: { id: string; name: string }[];
  buildingId: string | null;
  envBadge?: string;
  vapidPublicKey?: string;
  /** The house mark, rendered by the server shell (`shellBrand().compact`): markup, not client JS. */
  brand: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The staff PWA frame (F1 1.3 §1; redesign G7): one phone column with big targets, at every width.
 * - Tab roots: a 56-px top bar with the house mark, the organisation over the focused building (the switcher), sync,
 *   notifications and the account menu (theme incl. high contrast, device PIN); a five-place bottom nav —
 *   Today · Readings · Work orders · Parcels (as entitled) · More.
 * - Inner screens: a back arrow and the section's name. Task screens (a work order, a request, an inspection, an
 *   install wizard) also drop the bottom nav: their own sticky action bar holds the thumb zone.
 * - Offline: a band under the top bar says so in words, with what happens to the work saved meanwhile.
 */
export function StaffShellFrame(props: StaffShellFrameProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const lock = useDeviceLock();
  const [moreOpen, setMoreOpen] = useState(false);
  const [unsent, setUnsent] = useState<number | null>(null);
  const [leaving, startLeaving] = useTransition();
  // Set during render (not in an effect) so it is in place before any child's mount effect replays the queue;
  // browser only — module state on the server would be shared between requests.
  if (typeof window !== "undefined") setQueueIdentity({ userId: props.userId, tenantId: props.currentTenant.id });
  // The clean-up code loads on first use: the staff budget is 200 KB (D-179).
  const leave = () => startLeaving(async () => (await import("../pwa/leaveDevice")).signOutStaff("/login"));
  /** Sign-out deletes what is unsent on this phone (review H2): say so first when there is something. */
  const requestSignOut = () =>
    startLeaving(async () => {
      const { signOutStaff, unsentOnDevice } = await import("../pwa/leaveDevice");
      const count = await unsentOnDevice();
      if (count > 0) setUnsent(count);
      else await signOutStaff("/login");
    });
  // Marks the document interactive (hydrated): field automation and the e2e suite wait for it instead
  // of tapping server-rendered buttons that do nothing yet.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "staff";
  }, []);
  const inner = staffInnerRoute(pathname);
  const sectionLabel = inner ? props.items.find((item) => item.key === inner.section)?.label : undefined;
  const primary = props.items.slice(0, 3);
  const rest = props.items.slice(3);

  const bottom: NavItem[] = [
    { href: "/", label: props.todayLabel, icon: <Icon icon={IconHome} />, active: pathname === "/" },
    ...primary.map((item) => ({
      href: item.href,
      label: item.label,
      icon: <Icon icon={item.icon} />,
      active: isActive(item.href, pathname) || inner?.section === item.key,
    })),
    {
      href: "#more",
      label: t("staff.nav.more"),
      icon: <Icon icon={IconMore} />,
      active: rest.some((item) => isActive(item.href, pathname) || inner?.section === item.key),
      onSelect: () => setMoreOpen(true),
    },
  ];

  const account = (
    <UserMenu
      displayName={props.userName}
      roleLabel={props.roleLabel}
      loginHref="/login"
      size="lg"
      onSignOut={requestSignOut}
      extraItems={[
        {
          id: "pin",
          label: lock.enabled ? t("staff.lock.changePin") : t("staff.lock.setPin"),
          icon: IconLock,
          separatorBefore: true,
          onSelect: lock.openSetup,
        },
        ...(lock.enabled
          ? [
              {
                id: "pin-remove",
                label: t("staff.lock.removePin"),
                icon: IconClose,
                onSelect: lock.remove,
              },
            ]
          : []),
      ]}
    />
  );

  return (
    <AppShell
      variant="mobile"
      skipLabel={t("shell.skipToContent")}
      header={
        <>
          <TopBar className="px-0">
            <div className="max-w-phone mx-auto flex w-full min-w-0 items-center gap-1 px-2">
              {inner ? (
                <>
                  <a
                    href={inner.back}
                    aria-label={t("common.back")}
                    className="rounded-control text-fg hover:bg-bg-subtle flex size-12 shrink-0 items-center justify-center text-2xl"
                    data-testid="shell-back"
                  >
                    <Icon icon={IconBack} className="rtl:rotate-180" />
                  </a>
                  <p className="min-w-0 flex-1 truncate text-lg font-semibold">{sectionLabel}</p>
                  <span className="sr-only" data-testid="tenant-role">
                    {props.roleLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex shrink-0 ps-2 pe-1" data-testid="brand-compact">
                    {props.brand}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1" data-testid="session-summary">
                    {props.tenants.length > 1 ? (
                      <TenantSwitcher zone="staff" tenants={props.tenants} currentTenantId={props.currentTenant.id} />
                    ) : (
                      <span className="sr-only" data-testid="tenant-name">
                        {props.currentTenant.displayName}
                      </span>
                    )}
                    <BuildingSelect buildings={props.buildings} buildingId={props.buildingId} />
                    <span className="sr-only" data-testid="tenant-role">
                      {props.roleLabel}
                    </span>
                  </div>
                </>
              )}
              <span className="ms-auto flex shrink-0 items-center">
                <EnvBadge label={props.envBadge} className="hidden min-[400px]:inline" />
                <SyncCenter />
                {inner ? null : (
                  <>
                    <NotificationCentre zone="staff" size="lg" />
                    {account}
                  </>
                )}
              </span>
            </div>
          </TopBar>
          <OfflineBanner />
        </>
      }
      bottomNav={
        inner?.task ? undefined : (
          <div className="max-w-phone mx-auto">
            <BottomNav items={bottom} label={t("shell.bottomNav")} size="lg" />
          </div>
        )
      }
      bottomNavAlways
    >
      {props.banner}
      <PushPrompt vapidPublicKey={props.vapidPublicKey} />
      {props.children}
      <LazyAlertDialog
        open={unsent !== null}
        onOpenChange={(next) => !next && !leaving && setUnsent(null)}
        title={t("staff.offline.signOutUnsentTitle")}
        description={t("staff.offline.signOutUnsent", { count: unsent ?? 0 })}
        confirmLabel={t("auth.signOut")}
        cancelLabel={t("common.cancel")}
        tone="destructive"
        loading={leaving}
        onConfirm={leave}
      />
      <LazySheet open={moreOpen} onOpenChange={setMoreOpen} title={t("shell.moreMenu")} closeLabel={t("common.close")}>
        <ul className="divide-border flex flex-col divide-y">
          {rest.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                aria-current={isActive(item.href, pathname) ? "page" : undefined}
                className="hover:bg-bg-subtle flex min-h-14 items-center gap-4 px-1 text-lg font-medium"
              >
                <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-10 shrink-0 items-center justify-center text-xl">
                  <Icon icon={item.icon} />
                </span>
                {item.label}
              </a>
            </li>
          ))}
          <li className="flex min-h-14 items-center justify-between gap-3 px-1">
            <span className="text-muted">{t("shell.languageSwitch.label")}</span>
            <LanguageSwitch zone="staff" />
          </li>
        </ul>
      </LazySheet>
    </AppShell>
  );
}
