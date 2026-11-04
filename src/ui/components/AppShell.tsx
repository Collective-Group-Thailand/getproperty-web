import { cn } from "../lib/cn";

export interface AppShellProps {
  /** Sticky top bar: wordmark, property switcher, account. */
  header?: React.ReactNode;
  /** Collapsible side navigation inside the classic header + sidebar frame (unused by the consoles since the redesign). */
  sidebar?: React.ReactNode;
  /**
   * The consoles' one navigation column (redesign G0): a single element that is the top bar on phones and the full-height
   * sidebar from `md` — brand, workspace, search, the menu (scrolling) and the account pinned at the bottom. Rendered
   * once, so every control exists once in the page. When set, `header` and `sidebar` are ignored.
   */
  rail?: React.ReactNode;
  /** Bottom nav on phones (staff, the resident app; the owner's phone layout). */
  bottomNav?: React.ReactNode;
  /** Keep the bottom nav at every width (the staff PWA is one phone column on a tablet or a desk screen too). */
  bottomNavAlways?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Text of the skip link, from `src/i18n` (WCAG 2.4.1). */
  skipLabel: string;
  /** Accessible name for the sidebar's `<nav>`. */
  sidebarLabel?: string;
  sidebarCollapsed?: boolean;
  /** Staff and resident pages are phone-width columns; consoles use the full width. */
  variant?: "console" | "mobile";
  className?: string;
}

/**
 * The page frame every zone shares: one skip link, one `<main id="main">`, landmarks in the right
 * order (design-system.md §6). A server component with no state: the collapse toggle and the
 * command palette are client components the zone shells own and pass in.
 */
export function AppShell({
  header,
  sidebar,
  rail,
  bottomNav,
  bottomNavAlways = false,
  footer,
  children,
  skipLabel,
  sidebarLabel,
  sidebarCollapsed = false,
  variant = "console",
  className,
}: AppShellProps) {
  if (rail) {
    return (
      <div className={cn("bg-bg min-h-dvh md:flex", className)}>
        <a href="#main" className="skip-link">
          {skipLabel}
        </a>
        <div className="contents print:hidden">{rail}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* tabIndex={-1} so the skip link can move focus here. */}
          <main
            id="main"
            tabIndex={-1}
            className={cn("min-w-0 flex-1", bottomNav && "pb-(--bottom-nav-h) md:pb-0 print:pb-0")}
          >
            {children}
          </main>
          {footer}
        </div>
        {bottomNav ? (
          <div className="border-border bg-surface z-sticky fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
            {bottomNav}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("bg-bg flex min-h-dvh flex-col", className)}>
      <a href="#main" className="skip-link">
        {skipLabel}
      </a>

      <div className="contents print:hidden">{header}</div>

      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <nav
            aria-label={sidebarLabel}
            className={cn(
              "border-border bg-surface hidden shrink-0 border-e md:block print:hidden",
              "motion-safe:duration-slow motion-safe:transition-[width]",
              sidebarCollapsed ? "w-16" : "w-60",
            )}
          >
            <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-3">{sidebar}</div>
          </nav>
        ) : null}

        {/* tabIndex={-1} so the skip link can move focus here. */}
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1",
            variant === "mobile" && "max-w-phone mx-auto w-full px-4",
            bottomNav && "pb-(--bottom-nav-h) print:pb-0",
            bottomNav && !bottomNavAlways && "md:pb-0",
          )}
        >
          {children}
        </main>
      </div>

      {footer}

      {bottomNav ? (
        <div
          className={cn(
            "border-border bg-surface z-sticky fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] print:hidden",
            !bottomNavAlways && "md:hidden",
          )}
        >
          {bottomNav}
        </div>
      ) : null}
    </div>
  );
}

/** The sticky top bar inside an AppShell. */
export function TopBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "border-border bg-surface z-sticky sticky top-0 flex h-14 items-center gap-3 border-b px-4",
        className,
      )}
    >
      {children}
    </header>
  );
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  /** Renders a button instead of a link (the "More" entry that opens a sheet). Client components only. */
  onSelect?: () => void;
  /** Extra decoration after the icon (a count badge); decorative — the label carries the meaning. */
  badge?: React.ReactNode;
  /** The section's own pages, listed under the entry (pass them only while the section is open). */
  children?: { href: string; label: string; active?: boolean; testId?: string }[];
}

/**
 * Sidebar entries: 40-px rows (44 px in the phone sheet, `size="touch"`), the active one marked for assistive tech with
 * `aria-current` and for the eye with the pale brand tint — no bar, no stripe. A count (`badge`) sits at the row's end and
 * must equal the rows the page shows (REDESIGN-PROMPT §4.4).
 */
export function SidebarNav({
  items,
  collapsed = false,
  size = "md",
}: {
  items: NavItem[];
  collapsed?: boolean;
  size?: "md" | "touch";
}) {
  return (
    <ul className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        // An open section marks the page under it; the entry itself only reads as the open section.
        const open = Boolean(item.children?.length) && !collapsed;
        const current = item.active && !(open && item.children?.some((child) => child.active));
        return (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={current ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "rounded-control duration-fast flex items-center gap-3 px-2.5 text-sm transition-colors",
                size === "touch" ? "h-11 text-base" : "h-10",
                current
                  ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                  : item.active
                    ? "text-fg hover:bg-bg-subtle font-semibold"
                    : "text-muted hover:bg-bg-subtle hover:text-fg font-medium",
                collapsed && "justify-center px-0",
              )}
            >
              <span className={cn("shrink-0 text-lg", item.active ? "text-primary" : "text-subtle")}>{item.icon}</span>
              <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
              {item.badge && !collapsed ? <span className="shrink-0">{item.badge}</span> : null}
            </a>
            {item.children && item.children.length > 0 && !collapsed ? (
              <ul className="border-border ms-[1.3rem] mt-0.5 mb-1 flex flex-col gap-0.5 border-s ps-2.5">
                {item.children.map((child) => (
                  <li key={child.href}>
                    <a
                      href={child.href}
                      aria-current={child.active ? "page" : undefined}
                      data-testid={child.testId}
                      className={cn(
                        "rounded-control duration-fast flex items-center px-2.5 transition-colors",
                        size === "touch" ? "h-11 text-base" : "h-9 text-sm",
                        child.active
                          ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                          : "text-muted hover:bg-bg-subtle hover:text-fg font-medium",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{child.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The phone bottom nav: up to five 56-px targets, icon + label, never icon alone. */
export function BottomNav({ items, label, size = "md" }: { items: NavItem[]; label: string; size?: "md" | "lg" }) {
  const itemClass = (active?: boolean) =>
    cn(
      "relative flex h-full w-full flex-col items-center justify-center gap-0.5 font-medium",
      size === "lg" ? "text-sm" : "text-xs",
      active ? "text-primary" : "text-muted",
    );
  return (
    <nav aria-label={label}>
      <ul className={cn("flex", size === "lg" ? "h-16" : "h-14")}>
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            {item.onSelect ? (
              <button type="button" onClick={item.onSelect} className={itemClass(item.active)}>
                <span className={cn("relative", size === "lg" ? "text-2xl" : "text-xl")}>
                  {item.icon}
                  {item.badge}
                </span>
                {item.label}
              </button>
            ) : (
              <a href={item.href} aria-current={item.active ? "page" : undefined} className={itemClass(item.active)}>
                <span className={cn("relative", size === "lg" ? "text-2xl" : "text-xl")}>
                  {item.icon}
                  {item.badge}
                </span>
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
