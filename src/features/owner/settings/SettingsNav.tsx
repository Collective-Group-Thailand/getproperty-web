import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/features/shared/console/PageHeader";
import { ShellBackLink } from "@/features/shared/shell/ShellBreadcrumbs";
import type { Locale } from "@/i18n/routing";
import type { OwnerMe, Schemas } from "@/lib/api/types";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconGlobe } from "@/ui/icons/glyphs/globe";
import { IconHelp } from "@/ui/icons/glyphs/help";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconIdentify } from "@/ui/icons/glyphs/identify";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { cn } from "@/ui/lib/cn";

import { ownerPath } from "../shared/links";

type PageKey = Schemas["OwnerMenuKey"] | "sign_in" | "verification" | "line_oa" | "facebook_page";
type Group = "organisation" | "channels" | "security";

/** The settings sections in three groups (redesign G6): organisation · channels · security and data. */
const PAGES: { key: PageKey; path: string; group: Group; icon: IconGlyph }[] = [
  { key: "settings", path: "/settings", group: "organisation", icon: IconBuilding },
  { key: "bank_accounts", path: "/settings/bank-accounts", group: "organisation", icon: IconBank },
  { key: "members", path: "/settings/members", group: "organisation", icon: IconResidents },
  // Personal (D-267): every member may verify their identity; the owner's shows on the listings.
  { key: "verification", path: "/settings/verification", group: "organisation", icon: IconIdentify },
  // D-254: whoever opens the general settings connects the tenant's own LINE OA.
  { key: "line_oa", path: "/settings/line-oa", group: "channels", icon: IconChat },
  // G4 (D-288): the tenant's own Facebook Page for automatic listing posts, next to its LINE OA.
  { key: "facebook_page", path: "/settings/facebook-page", group: "channels", icon: IconGlobe },
  { key: "notifications", path: "/settings/notifications", group: "channels", icon: IconBell },
  { key: "privacy", path: "/settings/privacy", group: "security", icon: IconShield },
  { key: "support_access", path: "/settings/support-access", group: "security", icon: IconHelp },
  { key: "access_grants", path: "/settings/access-grants", group: "security", icon: IconKey },
  { key: "audit_log", path: "/settings/audit-log", group: "security", icon: IconHistory },
  // Personal (D-255): every member manages their own ways to sign in.
  { key: "sign_in", path: "/settings/sign-in", group: "security", icon: IconLock },
];
const GROUPS: Group[] = ["organisation", "channels", "security"];

export type SettingsPage = (typeof PAGES)[number]["path"];

/** The sections the member's role opens (the API's menu) — a manager never sees the bank accounts. */
function allowedPages(me: OwnerMe) {
  const allowed = new Set(me.menu);
  return PAGES.filter(
    (page) =>
      page.key === "sign_in" ||
      page.key === "verification" ||
      (page.key === "line_oa" || page.key === "facebook_page" ? allowed.has("settings") : allowed.has(page.key)),
  );
}

/**
 * The settings frame (redesign G6, Stitch "settings"): the console rail, a 200-px list of the sections in three
 * captioned groups, and the section's column — its title, one line of what it is for, at most one filled action, then
 * numbered cards. On phones the list is the `/settings` index (`SettingsIndex`); a section opens on its own with a way
 * back to it.
 */
export async function SettingsFrame({
  me,
  locale,
  current,
  title,
  description,
  actions,
  status,
  index = false,
  children,
  testId,
}: {
  me: OwnerMe;
  locale: Locale;
  current: SettingsPage;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  /** `/settings` itself on a phone: the section list instead of the general section. */
  index?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const t = await getTranslations("owner.settings.nav");
  const pages = allowedPages(me);
  const href = (path: string) => ownerPath(locale, path);
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-5 pb-10 md:px-8 md:pt-8 md:pb-16 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-10"
      data-testid={testId}
    >
      <nav aria-label={t("label")} className="hidden lg:sticky lg:top-8 lg:flex lg:flex-col lg:gap-6">
        <p className="text-lg font-semibold">{t("title")}</p>
        {GROUPS.map((group) => {
          const items = pages.filter((page) => page.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`settings-group-${group}`} className="flex flex-col gap-1">
              <h2 id={`settings-group-${group}`} className="text-muted px-3 pb-1 text-xs font-medium">
                {t(`group.${group}`)}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {items.map((page) => {
                  const active = page.path === current;
                  return (
                    <li key={page.key}>
                      <a
                        href={href(page.path)}
                        aria-current={active ? "page" : undefined}
                        data-testid={`settings-tab-${page.key}`}
                        className={cn(
                          "rounded-control duration-fast flex h-9 items-center px-3 text-sm transition-colors",
                          active
                            ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                            : "text-muted hover:bg-bg-subtle hover:text-fg font-medium",
                        )}
                      >
                        <span className="truncate">{t(page.key)}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>

      {index ? (
        <div className="flex flex-col gap-6 lg:hidden" data-testid="settings-index">
          <header className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-muted text-base">{t("lede")}</p>
          </header>
          {GROUPS.map((group) => {
            const items = pages.filter((page) => page.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`settings-index-${group}`} className="flex flex-col gap-2">
                <h2 id={`settings-index-${group}`} className="text-muted px-1 text-sm font-medium">
                  {t(`group.${group}`)}
                </h2>
                <ul className="rounded-card border-border bg-surface shadow-card divide-border divide-y border">
                  {items.map((page) => (
                    <li key={page.key}>
                      <a
                        href={href(page.key === "settings" ? "/settings?section=general" : page.path)}
                        className="hover:bg-bg-subtle flex min-h-14 items-center gap-3 px-4 py-2"
                        data-testid={`settings-index-${page.key}`}
                      >
                        <Icon icon={page.icon} className="text-subtle shrink-0 text-xl" />
                        <span className="min-w-0 flex-1 truncate text-base font-medium">{t(page.key)}</span>
                        <Icon icon={IconChevronRight} className="text-subtle shrink-0 rtl:rotate-180" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      <div className={cn("flex max-w-[52rem] min-w-0 flex-col gap-6", index && "max-lg:hidden")}>
        <div className="flex flex-col gap-3">
          <div className="lg:hidden">
            <ShellBackLink back={{ label: t("title"), href: href("/settings") }} />
          </div>
          <PageHeader title={title} description={description} actions={actions} status={status} back={null} />
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * A numbered card of a settings section (Stitch: "1. ข้อมูลบริษัท"): the number in brand ink, the title, one line of
 * help, an optional action at the head, then its rows.
 */
export function SettingsCard({
  number,
  title,
  description,
  action,
  children,
  id,
  testId,
  flush = false,
  className,
}: {
  number?: number;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  id: string;
  testId?: string;
  /** Rows run edge to edge (a list or a table) instead of sitting in the card's padding. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card border-border bg-surface shadow-card scroll-mt-6 border",
        // Rows that run edge to edge keep the card's corners (a sticky save bar inside opts out with overflow-visible).
        flush && "overflow-hidden",
        className,
      )}
      data-testid={testId}
    >
      <header className="border-border flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:px-6">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold">
            {number !== undefined ? <span className="text-primary me-1.5 tabular-nums">{number}.</span> : null}
            {title}
          </h2>
          {description ? <p className="text-muted mt-0.5 text-sm text-pretty">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={flush ? undefined : "px-5 py-5 md:px-6"}>{children}</div>
    </section>
  );
}
