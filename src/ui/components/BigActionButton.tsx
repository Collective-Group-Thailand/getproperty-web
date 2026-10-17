import { Icon, type IconGlyph } from "../icons";
import { IconChevronRight } from "../icons/glyphs/chevron-right";
import { cn } from "../lib/cn";

interface BigActionBase {
  icon: IconGlyph;
  /** What tapping does ("จดมิเตอร์"). */
  title: React.ReactNode;
  /** One line under the title ("เหลือ 12 จุด ก่อน 25 ต.ค."). */
  description?: React.ReactNode;
  /** A number that matters at a glance (tasks left); part of the accessible name. */
  count?: number;
  /** `primary` = the one thing to do now; `default` = a task among others. */
  tone?: "default" | "primary";
  className?: string;
}

export type BigActionButtonProps = BigActionBase &
  (
    | ({ href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "title" | "href">)
    | ({ href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title">)
  );

/**
 * The staff PWA's task tile (design-system.md §3 "BigActionButton (staff)"): a full-width, ≥ 72-px tap
 * target with an icon, a title, a one-line status, a count and a chevron — for one-handed use with
 * gloves in the sun. With `href` it is a link (navigation to a task), otherwise a button. Not for form
 * submits (that is `Button size="xl"`). Renders on the server as well as the client.
 */
export function BigActionButton(props: BigActionButtonProps) {
  const { icon, title, description, count, tone = "default", className, ...rest } = props;
  const classes = cn(
    "rounded-card flex min-h-18 w-full items-center gap-4 border px-4 py-3 no-underline",
    "transition-[background-color,box-shadow] duration-fast ease-standard aria-disabled:opacity-50 disabled:opacity-50",
    tone === "primary"
      ? "bg-primary text-primary-fg hover:bg-primary-hover border-transparent"
      : "border-border bg-surface text-fg shadow-card hover:bg-bg-subtle",
    className,
  );
  const content = (
    <>
      <span
        className={cn(
          "rounded-control flex size-12 shrink-0 items-center justify-center",
          tone === "primary" ? "bg-primary-fg/15" : "bg-primary-subtle text-primary-subtle-fg",
        )}
      >
        <Icon icon={icon} size={28} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-start">
        <span className="text-lg leading-snug font-semibold">{title}</span>
        {description ? (
          <span className={cn("text-sm", tone === "primary" ? "text-primary-fg/90" : "text-muted")}>{description}</span>
        ) : null}
      </span>
      {count !== undefined ? (
        <span className="text-2xl font-semibold tabular-nums" data-testid="big-action-count">
          {count}
        </span>
      ) : null}
      <Icon icon={IconChevronRight} size={24} className="opacity-70" />
    </>
  );
  if (rest.href !== undefined) {
    const { href, ...anchor } = rest as { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a href={href} className={classes} {...anchor}>
        {content}
      </a>
    );
  }
  const { type, ...button } = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type ?? "button"} className={classes} {...button}>
      {content}
    </button>
  );
}
