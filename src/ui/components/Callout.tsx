import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconGlyph } from "../icons";
import { IconAlert } from "../icons/glyphs/alert";
import { IconCheckCircle } from "../icons/glyphs/check-circle";
import { IconInfo } from "../icons/glyphs/info";
import { IconWarning } from "../icons/glyphs/warning";
import { cn } from "../lib/cn";

const calloutVariants = cva("flex border text-sm", {
  variants: {
    size: {
      md: "gap-3 rounded-card p-4",
      /** One line inside a card or a panel (a listing's review reason, a sentence of status). */
      sm: "gap-2 rounded-control px-3 py-2",
    },
    tone: {
      info: "border-info/30 bg-info-subtle text-info-subtle-fg",
      success: "border-success/30 bg-success-subtle text-success-subtle-fg",
      /** Needs attention — an estimated reading, a slip waiting (D-100). */
      warning: "border-warning/40 bg-warning-subtle text-warning-subtle-fg",
      /** A refusal — including a compliance refusal, which always shows its `legalRef`. */
      danger: "border-danger/30 bg-danger-subtle text-danger-subtle-fg",
      neutral: "border-border bg-bg-subtle text-fg",
    },
  },
  defaultVariants: { tone: "info", size: "md" },
});

const TONE_ICON: Record<NonNullable<VariantProps<typeof calloutVariants>["tone"]>, IconGlyph> = {
  info: IconInfo,
  success: IconCheckCircle,
  warning: IconWarning,
  danger: IconAlert,
  neutral: IconInfo,
};

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  title?: React.ReactNode;
  children: React.ReactNode;
  /** A legal reference ("ตามประกาศ สคบ. ข้อ 4(1)") shown under the body, from the API's `legalRef`. */
  legalRef?: React.ReactNode;
  action?: React.ReactNode;
  icon?: IconGlyph;
  /**
   * `false` for a standing fact that is part of the content (a card's review reason) rather than news: no live
   * region, so a list of cards is not read out as alerts. Default `true`.
   */
  live?: boolean;
  className?: string;
}

/** An inline notice. `role="status"` for info/success, `role="alert"` for warning/danger (announced). */
export function Callout({
  tone = "info",
  size = "md",
  title,
  children,
  legalRef,
  action,
  icon,
  live = true,
  className,
}: CalloutProps) {
  const urgent = tone === "danger" || tone === "warning";
  return (
    <div
      role={live ? (urgent ? "alert" : "status") : undefined}
      className={cn(calloutVariants({ tone, size }), className)}
    >
      <Icon
        icon={icon ?? TONE_ICON[tone ?? "info"]}
        className={cn("shrink-0", size === "sm" ? "mt-0.5 text-base" : "mt-0.5 text-lg")}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className={size === "sm" ? "font-medium" : "font-semibold"}>{title}</p> : null}
        <div>{children}</div>
        {legalRef ? <p className="text-xs opacity-90">{legalRef}</p> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
