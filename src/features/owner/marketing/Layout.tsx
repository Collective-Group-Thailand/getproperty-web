import { Button } from "@/ui/components/Button";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { cn } from "@/ui/lib/cn";

/*
 * The public site's layout grammar (G1 redesign, 2026-11-03). One measure (1280 px, 12 columns, 16/24/32-px gutters),
 * one vertical rhythm (64 / 96 px between sections), four type levels (the page's h1 in `display`, a section's h2 in
 * `3xl`, an item's h3 in `xl`, body and meta) and light surfaces only: the off-white page, white cards on a hairline,
 * the pale subtle band for a quiet section. Every public page is built from these so header, sections and footer line
 * up from page to page.
 */

/** The page measure: 1280 px with the gutters of a 12-column grid. */
export const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export function Container({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "header" | "nav" | "article";
}) {
  return <Tag className={cn(WRAP, className)}>{children}</Tag>;
}

/** A link back to the page above (on detail pages only, never a breadcrumb trail). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="text-muted hover:text-fg rounded-control -ms-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm font-medium print:hidden"
    >
      <Icon icon={IconChevronLeft} />
      {label}
    </a>
  );
}

/**
 * The opening of a page: an optional back link and small label, the one h1, one line that says what the page is for,
 * and the page's actions. `aside` takes the right-hand five columns (a photo, a figure); without it the head is a
 * single reading column.
 */
export function PageHead({
  back,
  eyebrow,
  title,
  lede,
  actions,
  aside,
  children,
  testId,
  titleTestId,
  className,
  size = "display",
}: {
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  /** Under the lede and actions (a search form, a list of facts). */
  children?: React.ReactNode;
  testId?: string;
  titleTestId?: string;
  className?: string;
  /** `section`: a tool or record page whose task follows at once — a smaller h1. */
  /** `search`: a list people came to use (`/rent`) — the display h1 from `md`, a compact one on phones. */
  size?: "display" | "section" | "search";
}) {
  return (
    <header className={cn(WRAP, "pt-8 pb-10 md:pt-12 md:pb-14", className)}>
      {back ? <BackLink {...back} /> : null}
      <div className={cn("grid gap-10 lg:grid-cols-12 lg:gap-8", back ? "mt-4 md:mt-6" : "md:mt-4")}>
        <div
          className={cn("flex min-w-0 flex-col gap-5", aside ? "lg:col-span-6 lg:self-center" : "lg:col-span-9")}
          data-testid={testId}
        >
          {eyebrow ? <p className="text-muted m-0 text-sm font-medium">{eyebrow}</p> : null}
          <h1
            className={cn(
              "m-0 text-balance",
              size === "display" ? "text-display" : size === "search" ? "md:text-display text-3xl" : "text-4xl",
            )}
            data-testid={titleTestId}
          >
            {title}
          </h1>
          {lede ? <p className="text-muted m-0 max-w-2xl text-lg text-pretty">{lede}</p> : null}
          {actions ? <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">{actions}</div> : null}
          {children}
        </div>
        {aside ? <div className="min-w-0 lg:col-span-6">{aside}</div> : null}
      </div>
    </header>
  );
}

/** A section of a page: the measure, the rhythm, and an optional quiet band (`subtle`). */
export function Section({
  id,
  tone = "plain",
  labelledBy,
  label,
  className,
  innerClassName,
  children,
}: {
  id?: string;
  tone?: "plain" | "subtle";
  labelledBy?: string;
  label?: string;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      aria-label={label}
      className={cn(
        "scroll-mt-24",
        tone === "subtle" && "bg-surface-subtle border-border border-y print:bg-transparent",
        className,
      )}
    >
      <div className={cn(WRAP, "py-16 md:py-24", innerClassName)}>{children}</div>
    </section>
  );
}

/** A section's head: small label, the h2, one line, and the section's own link at the right. */
export function SectionHead({
  id,
  eyebrow,
  title,
  lede,
  action,
  className,
}: {
  id: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-12 md:items-end md:gap-8", className)}>
      <div className="flex flex-col gap-3 md:col-span-8">
        {eyebrow ? <p className="text-muted m-0 text-sm font-medium">{eyebrow}</p> : null}
        <h2 id={id} className="m-0 text-3xl text-balance">
          {title}
        </h2>
        {lede ? <p className="text-muted m-0 max-w-2xl text-lg text-pretty">{lede}</p> : null}
      </div>
      {action ? <div className="md:col-span-4 md:justify-self-end">{action}</div> : null}
    </div>
  );
}

/** A quiet text link with an arrow — the secondary action beside a button, or a section's own link. */
export function TextLink({
  href,
  children,
  external = false,
  className,
  testId,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <a
      href={href}
      data-testid={testId}
      className={cn(
        "text-fg decoration-border-strong hover:decoration-fg inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-1 underline-offset-[6px]",
        className,
      )}
      {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
    >
      {children}
    </a>
  );
}

/** Numbered steps on hairlines, in up to four columns. */
export function Steps({
  items,
  columns = 4,
  className,
}: {
  items: { key: string; title: string; body: string }[];
  columns?: 3 | 4 | 5;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "m-0 grid list-none gap-x-8 gap-y-10 p-0 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        columns === 5 && "lg:grid-cols-5",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={item.key} className="border-border flex flex-col gap-2 border-t pt-5">
          <span className="text-primary font-mono text-sm tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <h3 className="m-0 text-xl">{item.title}</h3>
          <p className="text-muted m-0 text-pretty">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Facts or features as a two-column list of title + one line, on hairlines (no icon tiles). */
export function FeatureList({
  items,
  className,
}: {
  items: { key: string; title: string; body: string; icon?: IconGlyph }[];
  className?: string;
}) {
  return (
    <ul className={cn("border-border m-0 grid list-none border-t p-0 md:grid-cols-2 md:gap-x-16", className)}>
      {items.map((item) => (
        <li key={item.key} className="border-border flex gap-4 border-b py-5">
          {item.icon ? <Icon icon={item.icon} className="text-primary mt-1 shrink-0 text-xl" /> : null}
          <span className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{item.title}</span>
            <span className="text-muted text-pretty">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Questions and answers as disclosures; the first one open when asked. */
export function FaqList({
  items,
  openFirst = false,
  className,
}: {
  items: { q: string; a: string }[];
  openFirst?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("border-border border-t", className)}>
      {items.map((item, index) => (
        <details key={item.q} className="group border-border border-b" open={openFirst && index === 0}>
          <summary className="hover:text-primary flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            {item.q}
            <Icon
              icon={IconChevronDown}
              className="text-muted shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="text-muted m-0 max-w-3xl pb-5 text-pretty">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * Explanatory or search-engine content under the page's task, folded. The section's own action sits beside the
 * summary, outside the disclosure, so it stays visible while the section is closed.
 */
export function Fold({
  id,
  title,
  hint,
  action,
  children,
  open = false,
  className,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("border-border scroll-mt-24 border-t", className)}>
      <div className="flex flex-col gap-x-8 sm:flex-row sm:items-start">
        <details className="group min-w-0 flex-1" open={open}>
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-5 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={id} className="m-0 text-2xl">
                {title}
              </h2>
              {hint ? <span className="text-muted text-sm">{hint}</span> : null}
            </span>
            <span className="border-border bg-surface text-muted group-hover:text-fg grid size-10 shrink-0 place-items-center rounded-full border">
              <Icon
                icon={IconChevronDown}
                className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </span>
          </summary>
          <div className="pb-10">{children}</div>
        </details>
        {action ? <div className="shrink-0 pb-5 sm:pt-6">{action}</div> : null}
      </div>
    </section>
  );
}

/**
 * The closing call to action: a white panel on a hairline — never a dark block — with one line, one button and at
 * most one quiet link.
 */
export function CtaPanel({
  id,
  title,
  body,
  primary,
  secondary,
  className,
  variant = "panel",
}: {
  id: string;
  title: string;
  body?: string;
  primary: { href: string; label: string; external?: boolean; icon?: IconGlyph; testId?: string };
  secondary?: { href: string; label: string; external?: boolean };
  className?: string;
  /**
   * `band`: a slim strip with one outlined button — for pages whose filled action is elsewhere (the renter's search,
   * a free tool), so the owner invitation never competes with the page's own task.
   */
  variant?: "panel" | "band";
}) {
  const external = (on?: boolean) => (on ? { rel: "noopener noreferrer", target: "_blank" } : {});
  if (variant === "band")
    return (
      <section aria-labelledby={id} className={cn(WRAP, "py-12 md:py-16 print:hidden", className)}>
        <div className="bg-surface border-border rounded-card flex flex-col gap-4 border px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={id} className="m-0 text-xl text-balance">
              {title}
            </h2>
            {body ? <p className="text-muted m-0 max-w-2xl text-pretty">{body}</p> : null}
          </div>
          <Button asChild variant="secondary" iconStart={primary.icon} className="shrink-0 self-start md:self-auto">
            <a href={primary.href} data-testid={primary.testId} {...external(primary.external)}>
              {primary.label}
            </a>
          </Button>
        </div>
      </section>
    );
  return (
    <section aria-labelledby={id} className={cn(WRAP, "py-16 md:py-24 print:hidden", className)}>
      <div className="bg-surface border-border rounded-panel shadow-card grid gap-8 border p-8 md:grid-cols-12 md:items-center md:p-12">
        <div className="flex flex-col gap-3 md:col-span-7">
          <h2 id={id} className="m-0 text-3xl text-balance">
            {title}
          </h2>
          {body ? <p className="text-muted m-0 max-w-xl text-lg text-pretty">{body}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:col-span-5 md:justify-end">
          <Button asChild size="lg" iconStart={primary.icon}>
            <a href={primary.href} data-testid={primary.testId} {...external(primary.external)}>
              {primary.label}
            </a>
          </Button>
          {secondary ? (
            <TextLink href={secondary.href} external={secondary.external}>
              {secondary.label}
            </TextLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * The phone's bottom bar for a page with one task (the listing's contact, a tool's result): fixed at the bottom with
 * the safe area, hidden from `lg` where the page's own panel carries the action. Leaves room under the footer.
 */
export function PhoneActionBar({ children, summary }: { children: React.ReactNode; summary?: React.ReactNode }) {
  return (
    <>
      <div
        className="bg-surface border-border z-sticky fixed inset-x-0 bottom-0 flex items-center gap-3 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden print:hidden"
        data-testid="phone-action-bar"
      >
        {summary ? <div className="min-w-0 flex-1">{summary}</div> : null}
        <div className={cn("flex gap-2", summary ? "shrink-0" : "flex-1 [&>*]:flex-1")}>{children}</div>
      </div>
      <div aria-hidden="true" className="h-24 lg:hidden print:hidden" />
    </>
  );
}

/**
 * A page-level status (not found, closed, expired): a centred white card with the status icon, an optional title,
 * one sentence and the one next step. The page's h1 above it names the status.
 */
export function StatusPanel({
  icon,
  tone = "neutral",
  title,
  body,
  action,
  testId,
  className,
}: {
  icon: IconGlyph;
  tone?: "neutral" | "success";
  title?: string;
  body: string;
  action?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border-border rounded-card shadow-card flex flex-col items-center gap-3 border px-6 py-10 text-center md:px-10",
        className,
      )}
      data-testid={testId}
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-full text-2xl",
          tone === "success" && "bg-success-subtle text-success-subtle-fg",
          tone === "neutral" && "border-border bg-bg text-muted border",
        )}
      >
        <Icon icon={icon} />
      </span>
      {title ? <h2 className="m-0 text-xl text-balance">{title}</h2> : null}
      <p className="text-muted m-0 max-w-md text-pretty">{body}</p>
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}

/** A single-task page in one reading column (check a code, answer an invitation): label, the h1, one line, the task. */
export function TaskPage({
  eyebrow,
  title,
  lede,
  titleTestId,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  titleTestId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14 md:pb-24">
      <div className="flex flex-col gap-3">
        {eyebrow ? <p className="text-muted m-0 text-sm font-medium">{eyebrow}</p> : null}
        <h1 className="m-0 text-4xl text-balance" data-testid={titleTestId}>
          {title}
        </h1>
        {lede ? <p className="text-muted m-0 text-lg text-pretty">{lede}</p> : null}
      </div>
      {children}
    </div>
  );
}
