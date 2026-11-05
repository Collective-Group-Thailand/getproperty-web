"use client";

import { Icon, type IconGlyph } from "../icons";
import { IconSpinner } from "../icons/glyphs/spinner";
import { cx as cn } from "../lib/cx";

/**
 * The tablet's own button, field and note (JW4): the console's `Button` / `Input` / `Callout` looks without their
 * console machinery (Radix `Slot`, the field context, variant classes for sizes the kiosk never uses), so the `/gate`
 * first load stays inside 180 KB (D-179). Same semantic tokens, same focus ring, same radius.
 */
const BUTTON = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-bg-subtle active:bg-bg-subtle",
  ghost: "text-inherit hover:bg-current/10",
  destructive: "border border-danger/45 bg-surface text-danger-subtle-fg hover:bg-danger-subtle",
  "destructive-solid": "bg-danger text-danger-fg hover:bg-danger-hover",
} as const;

export interface KioskButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON;
  /** Accepted for parity with the console button; the kiosk sizes buttons with classes (h-12…h-16). */
  size?: "md" | "lg" | "xl";
  block?: boolean;
  loading?: boolean;
  iconStart?: IconGlyph;
}

/** Size utilities a caller's `className` replaces (height, padding, text size, border width) — no tailwind-merge. */
const GROUPS = [/^h-/, /^px-/, /^text-(xs|sm|base|lg|xl|\dxl)$/, /^border(-\d)?$/];

export function kioskClasses(defaults: string, custom = ""): string {
  const mine = custom.split(/\s+/).filter(Boolean);
  return defaults
    .split(/\s+/)
    .filter((cls) => !GROUPS.some((group) => group.test(cls) && mine.some((own) => group.test(own))))
    .concat(mine)
    .join(" ");
}

export function KioskButton({
  variant = "primary",
  size = "lg",
  block,
  loading,
  iconStart,
  className,
  children,
  disabled,
  type,
  ...props
}: KioskButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "rounded-control inline-flex touch-manipulation items-center justify-center gap-2 font-semibold whitespace-nowrap",
        "duration-fast transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "xl" ? "h-14 px-8 text-lg" : size === "md" ? "h-11 px-4" : "h-12 px-6",
        block && "w-full",
        BUTTON[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Icon icon={IconSpinner} className="animate-spin" /> : iconStart ? <Icon icon={iconStart} /> : null}
      {children}
    </button>
  );
}

export function KioskInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={kioskClasses(
        "rounded-control border-border-strong bg-surface text-fg aria-invalid:border-danger duration-fast w-full border px-4 text-base transition-colors",
        className,
      )}
      {...props}
    />
  );
}

const NOTE = {
  info: "bg-info-subtle text-info-subtle-fg border-info/30",
  success: "bg-success-subtle text-success-subtle-fg border-success/30",
  warning: "bg-warning-subtle text-warning-subtle-fg border-warning/30",
  danger: "bg-danger-subtle text-danger-subtle-fg border-danger/30",
} as const;

/** A short state line in its tone (icon + words; the colour only repeats them). */
export function KioskNote({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof NOTE;
  icon: IconGlyph;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div role="status" className={cn("rounded-control flex items-start gap-3 border px-4 py-3", NOTE[tone])}>
      <Icon icon={icon} size={22} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

const CHIP = {
  neutral: "bg-neutral-subtle text-neutral-subtle-fg",
  primary: "bg-primary-subtle text-primary-subtle-fg",
  success: "bg-success-subtle text-success-subtle-fg",
  warning: "bg-warning-subtle text-warning-subtle-fg",
  danger: "bg-danger-subtle text-danger-subtle-fg",
  info: "bg-info-subtle text-info-subtle-fg",
} as const;

/** A state chip at kiosk size (icon + word, never colour alone): the console `Badge` without its size variants. */
export function KioskChip({
  tone = "neutral",
  icon,
  size = "md",
  className,
  children,
}: {
  tone?: keyof typeof CHIP;
  icon?: IconGlyph;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-thumb inline-flex w-fit items-center gap-1.5 font-medium whitespace-nowrap",
        size === "lg" ? "h-10 px-3 text-base" : size === "md" ? "h-7 px-2.5 text-sm" : "h-6 px-2 text-xs",
        CHIP[tone],
        className,
      )}
    >
      {icon ? <Icon icon={icon} /> : null}
      {children}
    </span>
  );
}

/** A state in words inside a row (the overstay line): the tone's ink with its icon. */
export function KioskStatusLine({
  tone,
  icon,
  children,
  testId,
}: {
  tone: "warning" | "danger" | "info";
  icon: IconGlyph;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "mt-0.5 flex items-center gap-1.5 text-sm font-medium",
        tone === "warning"
          ? "text-warning-subtle-fg"
          : tone === "danger"
            ? "text-danger-subtle-fg"
            : "text-info-subtle-fg",
      )}
    >
      <Icon icon={icon} />
      {children}
    </span>
  );
}

/** A person's initial in a round tile (the guard on shift): the console `Avatar` look, sized for the kiosk. */
export function KioskAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const letter = Array.from(name.trim().replace(/^[เ-ไ]/, ""))[0] ?? "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-primary-subtle text-primary-subtle-fg grid shrink-0 place-items-center font-semibold",
        size === "lg" ? "size-14 rounded-full text-xl" : "size-10 rounded-full text-base",
      )}
    >
      {letter.toLocaleUpperCase()}
    </span>
  );
}
