"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-control",
    "transition-colors duration-fast ease-standard",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        ghost: "text-muted hover:bg-bg-subtle hover:text-fg",
        secondary: "border border-border-strong bg-surface text-fg hover:bg-bg-subtle",
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
      },
      size: {
        /** 32 px — in a dense table row. Still ≥ 24 px (WCAG 2.5.8). */
        sm: "size-8 text-base",
        md: "size-10 text-lg",
        /** 48 px — staff zone and the resident app. */
        lg: "size-12 text-xl",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  name: IconName;
  /** Required: an icon-only control has no other accessible name. From `src/i18n`. */
  label: string;
  /** A decorative count (`<CountBadge>`) on the icon; put the number in `label` too. */
  badge?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

export function IconButton({ name, label, variant, size, className, type, badge, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      title={label}
      data-size={size ?? "md"}
      className={cn(iconButtonVariants({ variant, size }), badge ? "relative" : undefined, className)}
      {...props}
    >
      <Icon name={name} />
      {badge}
    </button>
  );
}
