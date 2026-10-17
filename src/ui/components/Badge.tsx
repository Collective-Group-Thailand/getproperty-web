import { cva, type VariantProps } from "class-variance-authority";

import type { StatusMeta } from "@/domain/status";

import { Icon, type IconGlyph } from "../icons";
import { cn } from "../lib/cn";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-neutral-subtle text-neutral-subtle-fg",
      primary: "bg-primary-subtle text-primary-subtle-fg",
      success: "bg-success-subtle text-success-subtle-fg",
      /** Amber: needs attention — never for money that is merely due (D-100). */
      warning: "bg-warning-subtle text-warning-subtle-fg",
      danger: "bg-danger-subtle text-danger-subtle-fg",
      info: "bg-info-subtle text-info-subtle-fg",
    },
    size: {
      sm: "h-5 px-2 text-xs",
      md: "h-6 px-2.5 text-sm",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  icon?: IconGlyph;
  className?: string;
}

export function Badge({ tone, size, icon, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)}>
      {icon ? <Icon icon={icon} /> : null}
      {children}
    </span>
  );
}

export interface StatusBadgeProps extends Pick<BadgeProps, "size" | "className"> {
  /** From `src/domain/status` — the only source of status tone, icon and label (CLAUDE.md). */
  status: StatusMeta;
  /** The translated label, resolved by the caller from `status.labelKey`. */
  label: string;
}

/** A status is always icon + text, never colour alone (design-system.md §2). */
export function StatusBadge({ status, label, size, className }: StatusBadgeProps) {
  return (
    <Badge tone={status.tone} icon={status.icon} size={size} className={className}>
      {label}
    </Badge>
  );
}
