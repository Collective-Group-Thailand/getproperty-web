import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface SpinnerProps {
  /** Announced to screen readers, from `src/i18n` ("กำลังโหลด…"). */
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Only where a skeleton cannot stand in — a button, an inline refresh. */
export function Spinner({ label, size = "md", className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <Icon
        name="spinner"
        className={cn(
          "animate-spin",
          size === "sm" && "text-base",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl",
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
