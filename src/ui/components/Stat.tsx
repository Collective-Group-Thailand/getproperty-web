import { Icon, type IconGlyph } from "../icons";
import { IconChevronDown } from "../icons/glyphs/chevron-down";
import { IconChevronUp } from "../icons/glyphs/chevron-up";
import { IconRemove } from "../icons/glyphs/remove";
import { cn } from "../lib/cn";
import { Card } from "./Card";

export interface StatProps {
  label: React.ReactNode;
  /** Already formatted by the caller (`formatTHB`, `formatUnits`, `formatNumber`). */
  value: React.ReactNode;
  /** "จาก 42 ห้อง", "เทียบเดือนก่อน +3" — formatted text from the API's figures. */
  hint?: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: React.ReactNode; good?: boolean };
  icon?: IconGlyph;
  /** The "money recovered" variant: teal figure. */
  variant?: "default" | "recovered";
  className?: string;
}

const TREND_ICON: Record<"up" | "down" | "flat", IconGlyph> = {
  up: IconChevronUp,
  down: IconChevronDown,
  flat: IconRemove,
};

/** A KPI card for the morning dashboard: one figure, its unit, and what changed. */
export function Stat({ label, value, hint, trend, icon, variant = "default", className }: StatProps) {
  return (
    <Card padding="md" className={cn("flex flex-col gap-1", className)}>
      <div className="text-muted flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        {icon ? <Icon icon={icon} className="text-lg" /> : null}
      </div>
      <p className={cn("font-display text-3xl font-semibold tabular-nums", variant === "recovered" && "text-primary")}>
        {value}
      </p>
      {(hint || trend) && (
        <p className="text-muted flex items-center gap-2 text-sm">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trend.good === true && "text-success-subtle-fg",
                trend.good === false && "text-danger-subtle-fg",
              )}
            >
              <Icon icon={TREND_ICON[trend.direction]} />
              {trend.label}
            </span>
          ) : null}
          {hint}
        </p>
      )}
    </Card>
  );
}
