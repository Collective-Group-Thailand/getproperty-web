import { cn } from "../lib/cn";

export interface AppShellProps {
  /** Sticky top bar: wordmark, property switcher, account. */
  header: React.ReactNode;
  /** Collapsible side navigation — owner and admin consoles. */
  sidebar?: React.ReactNode;
  /** Bottom nav on phones (staff, the resident app; the owner's phone layout). */
  bottomNav?: React.ReactNode;
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
  bottomNav,
  footer,
  children,
  skipLabel,
  sidebarLabel,
  sidebarCollapsed = false,
  variant = "console",
  className,
}: AppShellProps) {
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
            bottomNav && "pb-(--bottom-nav-h) md:pb-0 print:pb-0",
          )}
        >
          {children}
        </main>
      </div>

      {footer}

      {bottomNav ? (
        <div className="border-border bg-surface z-sticky fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
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
}

/** Sidebar entries: 44-px rows, the active one marked for assistive tech with `aria-current`. */
export function SidebarNav({ items, collapsed = false }: { items: NavItem[]; collapsed?: boolean }) {
  return (
    <ul className="space-y-1 px-2">
      {items.map((item) => (
        <li key={item.href}>
          <a
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "rounded-control flex h-11 items-center gap-3 px-3 text-base font-medium",
              item.active ? "bg-primary-subtle text-primary-subtle-fg" : "text-muted hover:bg-bg-subtle hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            <span className="text-xl">{item.icon}</span>
            <span className={cn(collapsed && "sr-only")}>{item.label}</span>
          </a>
        </li>
      ))}
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
