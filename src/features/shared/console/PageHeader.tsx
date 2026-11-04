import { PageCrumbs, ShellBackLink, ShellRecordTopBar } from "@/features/shared/shell/ShellBreadcrumbs";
import type { Crumb } from "@/ui/components/Breadcrumbs";
import { cn } from "@/ui/lib/cn";

/**
 * The head of a console page (REDESIGN-PROMPT §4.1–4.2): a back link on record pages (the shell's nearest parent, or
 * `back`), one `h1`, the record's status badge(s), a one-line lede and its actions — at most one filled primary, the
 * API's `nextActions`, never inferred. `crumbs` name the page's parents (building › unit …) for the back link.
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
  crumbs,
  back,
  backOnPhonesOnly,
  className,
  testId,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
  /** An explicit way back; `null` hides the shell's. */
  back?: { label: React.ReactNode; href: string } | null;
  /** The navigation column already shows the way back (a record's own menu): the link only on phones. */
  backOnPhonesOnly?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {crumbs ? <PageCrumbs items={crumbs} /> : null}
      {/* Phones: the way back is the record's top bar; from md it is the link above the title. */}
      <ShellRecordTopBar back={back} />
      {backOnPhonesOnly ? null : (
        <div className="max-md:hidden">
          <ShellBackLink back={back} />
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-balance" data-testid={testId}>
              {title}
            </h1>
            {status}
          </div>
          {description ? <div className="text-muted max-w-3xl text-base text-pretty">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
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
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 pt-5 pb-10 md:gap-8 md:px-8 md:pt-8 md:pb-16",
        wide ? "max-w-none" : "max-w-7xl",
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** The owner console's name for `ConsolePage`. */
export const OwnerPage = ConsolePage;
