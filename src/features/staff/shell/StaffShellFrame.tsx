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
import { Mark } from "@/ui/brand";
import { AppShell, BottomNav, TopBar, type NavItem } from "@/ui/components/AppShell";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { Icon } from "@/ui/icons";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconMore } from "@/ui/icons/glyphs/more";
import { LazyAlertDialog, LazySheet } from "@/ui/components/overlays";

import { useDeviceLock } from "../lock/DeviceLock";
import { signOutStaff, unsentOnDevice } from "../pwa/leaveDevice";
import { PushPrompt } from "../pwa/PushPrompt";
import { SyncCenter } from "../pwa/SyncCenter";

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
  envBadge?: string;
  vapidPublicKey?: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The staff PWA frame (F1 1.3 §1): a phone column with big targets — top bar with the tenant, the
 * offline indicator and sync badge, notifications and the account menu (theme incl. high contrast,
 * device PIN); bottom nav Today · Readings · Inspect · Work orders (R2) / Devices · More.
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
  const leave = () => startLeaving(() => signOutStaff("/login"));
  /** Sign-out deletes what is unsent on this phone (review H2): say so first when there is something. */
  const requestSignOut = () =>
    startLeaving(async () => {
      const count = await unsentOnDevice();
      if (count > 0) setUnsent(count);
      else await signOutStaff("/login");
    });
  // Marks the document interactive (hydrated): field automation and the e2e suite wait for it instead
  // of tapping server-rendered buttons that do nothing yet.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "staff";
  }, []);
  const primary = props.items.slice(0, 3);
  const rest = props.items.slice(3);

  const bottom: NavItem[] = [
    { href: "/", label: props.todayLabel, icon: <Icon icon={IconHome} />, active: pathname === "/" },
    ...primary.map((item) => ({
      href: item.href,
      label: item.label,
      icon: <Icon icon={item.icon} />,
      active: isActive(item.href, pathname),
    })),
    { href: "#more", label: t("staff.nav.more"), icon: <Icon icon={IconMore} />, onSelect: () => setMoreOpen(true) },
  ];

  return (
    <AppShell
      variant="mobile"
      skipLabel={t("shell.skipToContent")}
      header={
        <TopBar className="gap-2">
          <Mark size={28} className="text-primary shrink-0" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 items-center gap-2" data-testid="session-summary">
            {props.tenants.length > 1 ? (
              <TenantSwitcher zone="staff" tenants={props.tenants} currentTenantId={props.currentTenant.id} />
            ) : (
              <span className="truncate text-sm font-semibold" data-testid="tenant-name">
                {props.currentTenant.displayName}
              </span>
            )}
            <span className="sr-only" data-testid="tenant-role">
              {props.roleLabel}
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-0.5">
            <EnvBadge label={props.envBadge} className="hidden min-[400px]:inline" />
            <SyncCenter />
            <NotificationCentre zone="staff" size="lg" />
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
          </span>
        </TopBar>
      }
      bottomNav={<BottomNav items={bottom} label={t("shell.bottomNav")} size="lg" />}
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
        <ul className="flex flex-col gap-1">
          {rest.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                className="rounded-control hover:bg-bg-subtle flex min-h-12 items-center gap-3 px-3 text-lg"
              >
                <Icon icon={item.icon} className="text-muted" />
                {item.label}
              </a>
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-2">
            <span className="text-muted">{t("shell.languageSwitch.label")}</span>
            <LanguageSwitch zone="staff" />
          </li>
        </ul>
      </LazySheet>
    </AppShell>
  );
}
