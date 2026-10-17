"use client";

import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconGlyph } from "../icons";
import { IconSpinner } from "../icons/glyphs/spinner";
import { cn } from "../lib/cn";

/**
 * The one button (design-system.md §3). Variants are component-tier tokens expressed as CVA classes
 * over semantic colours — never a raw palette step, so every variant follows the theme and is covered
 * by the contrast gate.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap",
    "transition-[color,background-color,border-color] duration-fast ease-standard",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        secondary: "border border-border-strong bg-surface text-fg hover:bg-bg-subtle",
        ghost: "text-inherit hover:bg-current/10",
        /** Red is for destructive actions only and never the loudest thing on the page: an outline. */
        destructive: "border border-danger/45 bg-surface text-danger-subtle-fg hover:bg-danger-subtle",
        /** Only the confirm button inside an AlertDialog, where the destructive step is the point. */
        "destructive-solid": "bg-danger text-danger-fg hover:bg-danger-hover",
        link: "text-primary underline underline-offset-4 hover:text-primary-hover",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-base",
        /** Staff and resident: 48 px+ targets and 18 px text (design-system.md §5). */
        xl: "h-14 px-8 text-lg",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render as the child element (a `Link`, say) while keeping the button's looks. */
  asChild?: boolean;
  /** Shows a spinner and marks the button busy. The label stays in place so the name does not vanish. */
  loading?: boolean;
  /** Decorative icon before/after the label; the label still carries the meaning. */
  iconStart?: IconGlyph;
  iconEnd?: IconGlyph;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  iconStart,
  iconEnd,
  children,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  const iconBefore = loading ? (
    <Icon icon={IconSpinner} className="animate-spin" />
  ) : iconStart ? (
    <Icon icon={iconStart} />
  ) : null;

  return (
    <Component
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      data-size={size ?? "md"}
      {...props}
    >
      {iconBefore}
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
      {iconEnd ? <Icon icon={iconEnd} /> : null}
    </Component>
  );
}
