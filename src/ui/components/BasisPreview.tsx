import { cn } from "../lib/cn";
import { Icon } from "../icons";
import { IconCheckCircle } from "../icons/glyphs/check-circle";
import { IconWarning } from "../icons/glyphs/warning";

export interface BasisPreviewRow {
  key: string;
  /** "น้อยที่สุด", "มัธยฐาน", "มากที่สุด" — from `src/i18n`. */
  label: React.ReactNode;
  /** Amount per unit per cycle, formatted from the API's figure. */
  amount: React.ReactNode;
  /** Who pays it ("A-102 · 0.043476"), optional. */
  detail?: React.ReactNode;
}

/**
 * Basis preview (J-DESIGN §4, budget → rate): what one unit pays a cycle at the low, middle and high end, and the
 * total check under them — "รวม = งบ ✓" when the units add up to the budget's cycle amount, a warning in words when
 * they cannot (units without the weight). Every figure is the API's; the preview only lays them out.
 */
export function BasisPreview({
  caption,
  amountHeader,
  rows,
  check,
  busy,
  className,
}: {
  /** Accessible caption ("ค่าส่วนกลางต่อห้อง ต่อไตรมาส"), from `src/i18n`. */
  caption: string;
  /** Column heading of the amounts ("ต่อไตรมาส"). */
  amountHeader: React.ReactNode;
  rows: BasisPreviewRow[];
  check: { ok: boolean; label: React.ReactNode; detail?: React.ReactNode };
  /** A newer preview is on its way: the figures fade so nobody reads a stale one. */
  busy?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 transition-opacity", busy && "opacity-60", className)}
      aria-busy={busy || undefined}
      data-testid="basis-preview"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border text-muted border-b text-xs">
            <th scope="col" className="py-2 text-start font-medium">
              <span className="sr-only">{caption}</span>
            </th>
            <th scope="col" className="py-2 text-end font-medium">
              {amountHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-border border-b" data-testid={`preview-${row.key}`}>
              <th scope="row" className="py-2.5 text-start font-normal">
                <span className="flex flex-col">
                  <span>{row.label}</span>
                  {row.detail ? <span className="text-muted text-xs">{row.detail}</span> : null}
                </span>
              </th>
              <td className="py-2.5 text-end font-semibold tabular-nums">{row.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        className={cn(
          "m-0 flex items-start gap-2 text-sm font-medium",
          check.ok ? "text-success-subtle-fg" : "text-warning-subtle-fg",
        )}
        data-testid="preview-check"
        data-ok={check.ok}
      >
        <Icon icon={check.ok ? IconCheckCircle : IconWarning} className="mt-0.5 shrink-0" />
        <span className="flex flex-col">
          <span>{check.label}</span>
          {check.detail ? <span className="text-muted font-normal">{check.detail}</span> : null}
        </span>
      </p>
    </div>
  );
}
