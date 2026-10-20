import { PageCrumbs } from "@/features/shared/shell/ShellBreadcrumbs";
import type { Crumb } from "@/ui/components/Breadcrumbs";
import { cn } from "@/ui/lib/cn";

/**
 * The head of a console page (owner, admin) (design-system.md §4 "Status & next action"): one `h1`, what the page is
 * about, the status badge(s) of the record and its actions — the API's `nextActions`, never inferred.
 * `crumbs` extend the shell's breadcrumbs (building › unit …).
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
  crumbs,
  className,
  testId,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
  className?: string;
  testId?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      {crumbs ? <PageCrumbs items={crumbs} /> : null}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold" data-testid={testId}>
            {title}
          </h1>
          {status}
        </div>
        {description ? <div className="text-muted text-sm">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** The page body of a console screen (owner, admin): gutters and vertical rhythm shared by every page. */
export function ConsolePage({
  children,
  testId,
  wide,
}: {
  children: React.ReactNode;
  testId?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-6 md:px-8", wide ? "max-w-none" : "max-w-7xl")}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** The owner console's name for `ConsolePage`. */
export const OwnerPage = ConsolePage;
