import { cva, type VariantProps } from "class-variance-authority";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

import { cn } from "../lib/cn";

const moneyVariants = cva("tabular-nums", {
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-xl font-semibold",
      /** The tenant's bill hero: Anuphan, 36 px. */
      hero: "font-display text-4xl font-semibold",
    },
    tone: {
      default: "",
      muted: "text-muted",
      /** Positive money — paid, recovered. */
      success: "text-success-subtle-fg",
      /** Money due soon (amber), never red for merely due (D-100). */
      attention: "text-warning-subtle-fg",
      /** Overdue. */
      danger: "text-danger-subtle-fg",
    },
  },
  defaultVariants: { size: "md", tone: "default" },
});

export interface MoneyDisplayProps extends VariantProps<typeof moneyVariants> {
  /** The API's decimal string, rendered as-is — never a number this component computed. */
  amount: string;
  locale?: Locale;
  withSymbol?: boolean;
  className?: string;
}

/**
 * Display-only money (design-system.md §3 "MoneyInput (display-only formatting)"): `฿1,234.56` in
 * tabular figures. There is deliberately no editable money control in `src/ui` — amounts come from the
 * API; the one place a person types money (a manual payment) uses `NumberInput unit="บาท"` and sends
 * the string to the API to validate.
 */
export function MoneyDisplay({ amount, locale = "th", withSymbol = true, size, tone, className }: MoneyDisplayProps) {
  return (
    <span className={cn(moneyVariants({ size, tone }), className)} data-amount={amount}>
      {formatTHB(amount, locale, { withSymbol })}
    </span>
  );
}
