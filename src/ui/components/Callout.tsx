import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

const calloutVariants = cva("flex gap-3 rounded-card border p-4 text-sm", {
  variants: {
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
  defaultVariants: { tone: "info" },
});

const TONE_ICON: Record<NonNullable<VariantProps<typeof calloutVariants>["tone"]>, IconName> = {
  info: "info",
  success: "check-circle",
  warning: "warning",
  danger: "alert",
  neutral: "info",
};

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  title?: React.ReactNode;
  children: React.ReactNode;
  /** A legal reference ("ตามประกาศ สคบ. ข้อ 4(1)") shown under the body, from the API's `legalRef`. */
  legalRef?: React.ReactNode;
  action?: React.ReactNode;
  icon?: IconName;
  className?: string;
}

/** An inline notice. `role="status"` for info/success, `role="alert"` for warning/danger (announced). */
export function Callout({ tone = "info", title, children, legalRef, action, icon, className }: CalloutProps) {
  const urgent = tone === "danger" || tone === "warning";
  return (
    <div role={urgent ? "alert" : "status"} className={cn(calloutVariants({ tone }), className)}>
      <Icon name={icon ?? TONE_ICON[tone ?? "info"]} className="mt-0.5 shrink-0 text-lg" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
        {legalRef ? <p className="text-xs opacity-90">{legalRef}</p> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
