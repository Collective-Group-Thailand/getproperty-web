import { cn } from "../lib/cn";

export interface ChartPoint {
  /** Key of the point (an ISO bucket, a period key) — also the table's row key. */
  key: string;
  /** Axis / table label of the point, already formatted ("ต.ค. 69", "14:00"). */
  label: string;
  /** The API's decimal string (`null` = no data for the bucket: a gap, never a zero). */
  value: string | null;
}

export interface ChartProps {
  type: "line" | "bar";
  points: ChartPoint[];
  /** Accessible name of the figure, also its caption. */
  title: string;
  /** Formats a value for the table, tooltips and the axis (`formatUnits`, `formatTHB`, `formatPercent`). */
  formatValue: (value: string) => string;
  /** Labels of the data-table fallback: summary text and the two column headings. */
  table: { summary: string; label: string; value: string };
  /** What an empty series says ("ยังไม่มีข้อมูลช่วงนี้"). */
  emptyText: string;
  height?: number;
  /**
   * A fixed value axis (a 1–5 score) instead of one fitted to the data from zero: the plot spans `min`–`max` and the
   * grid lines sit on `ticks` (default: four evenly spaced lines).
   */
  domain?: { min: number; max: number; ticks?: number[] };
  className?: string;
  "data-testid"?: string;
}

const WIDTH = 640;
/** Vertical room in pixels (the plot is drawn 1:1 vertically): above for the top tick's label, below for the x labels. */
const PAD = { top: 22, bottom: 26 };

/**
 * A tokenised line or bar chart drawn as SVG on the server (design-system.md §3 "Charts"): no chart
 * library and no client JavaScript (D-179 — the owner budget is 260 KB), hover text from SVG `<title>`,
 * and the **data-table fallback** every chart must have (§6) in a native `<details>` right under it.
 *
 * The plot stretches to the card's width at a fixed pixel height (`preserveAspectRatio="none"`, strokes that do not
 * scale), and every label is HTML laid over it in pixels — 12-px axis text on a 390-px phone as on a desktop, never
 * shrunk with the drawing. Value labels sit on their grid line at the start, the period labels under the plot; on
 * phones every second period label steps aside when there are many.
 *
 * Values are the API's decimal strings. They are turned into numbers here only to place marks on the
 * canvas — never summed or shown as computed figures; every number a person reads is `formatValue` of
 * the string the API sent.
 */
export function Chart({
  type,
  points,
  title,
  formatValue,
  table,
  emptyText,
  height = 220,
  domain,
  className,
  "data-testid": testId,
}: ChartProps) {
  const values = points.map((point) => (point.value === null ? null : Number.parseFloat(point.value)));
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const empty = finite.length === 0;
  const max = domain ? domain.max : empty ? 1 : Math.max(...finite, 0);
  const min = domain ? domain.min : empty ? 0 : Math.min(...finite, 0);
  const span = max - min || 1;
  // A line keeps a little air at both ends so its first and last points are not cut by the card.
  const inset = type === "line" ? 12 : 0;
  const plotW = WIDTH - inset * 2;
  const plotH = height - PAD.top - PAD.bottom;
  const step = points.length > 1 ? plotW / (type === "bar" ? points.length : points.length - 1) : plotW;
  const x = (index: number) =>
    inset + (type === "bar" ? step * index + step / 2 : points.length > 1 ? step * index : plotW / 2);
  const y = (value: number) => PAD.top + plotH - ((value - min) / span) * plotH;
  const ticks = domain?.ticks ?? [0, 1, 2, 3].map((index) => min + (span * index) / 3);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const tip = (index: number) => [points[index]!.label, formatValue(points[index]!.value!)].join(": ");
  const left = (value: number) => `${((value / WIDTH) * 100).toFixed(3)}%`;
  const labelled = points.map((_, index) => index).filter((index) => index % labelEvery === 0);

  // A line is broken where a bucket has no data rather than drawn through it.
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (current.length) segments.push(current.join(" "));

  return (
    <figure className={cn("flex flex-col gap-2", className)} data-testid={testId}>
      <figcaption className="sr-only">{title}</figcaption>
      {empty ? (
        <p className="text-muted rounded-card border-border border border-dashed p-6 text-center text-sm">
          {emptyText}
        </p>
      ) : (
        <div className="relative w-full" style={{ height }}>
          <svg
            viewBox={`0 0 ${WIDTH} ${height}`}
            role="img"
            aria-label={title}
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
          >
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={WIDTH}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {type === "bar"
              ? values.map((value, index) =>
                  value === null || !Number.isFinite(value) ? null : (
                    <rect
                      key={points[index]!.key}
                      x={x(index) - Math.min(step * 0.35, 18)}
                      width={Math.min(step * 0.7, 36)}
                      y={Math.min(y(value), y(0))}
                      height={Math.max(1, Math.abs(y(0) - y(value)))}
                      className="fill-primary"
                    >
                      <title>{tip(index)}</title>
                    </rect>
                  ),
                )
              : segments.map((segment) => (
                  <polyline
                    key={segment}
                    points={segment}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            {type === "line"
              ? values.map((value, index) =>
                  value === null || !Number.isFinite(value) ? null : (
                    // A zero-length round-capped stroke: a 6-px dot that stays round however the plot stretches.
                    <line
                      key={points[index]!.key}
                      x1={x(index)}
                      x2={x(index)}
                      y1={y(value)}
                      y2={y(value)}
                      className="stroke-primary"
                      strokeWidth={6}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{tip(index)}</title>
                    </line>
                  ),
                )
              : null}
          </svg>
          <div aria-hidden="true" className="text-muted pointer-events-none absolute inset-0 text-xs tabular-nums">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="bg-surface/80 absolute start-0 -translate-y-full pe-1 pb-0.5 leading-none"
                style={{ top: y(tick) }}
              >
                {formatValue(tick.toFixed(2))}
              </span>
            ))}
            {labelled.map((index, order) => {
              const first = index === 0 && type === "line";
              const last = index === points.length - 1 && type === "line" && points.length > 1;
              return (
                <span
                  key={points[index]!.key}
                  className={cn(
                    "absolute bottom-0 leading-none whitespace-nowrap",
                    first ? "" : last ? "-translate-x-full" : "-translate-x-1/2",
                    labelled.length > 4 && order % 2 === 1 && "max-sm:hidden",
                  )}
                  style={{ left: first ? 0 : last ? "100%" : left(x(index)) }}
                >
                  {points[index]!.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <details className="text-sm">
        <summary className="text-primary w-fit cursor-pointer font-medium">{table.summary}</summary>
        <div className="border-border rounded-control relative mt-2 max-h-72 overflow-auto border">
          <table className="w-full text-sm" data-testid={testId ? `${testId}-table` : undefined}>
            <caption className="sr-only">{title}</caption>
            <thead className="bg-bg-subtle text-muted">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-start font-medium">
                  {table.label}
                </th>
                <th scope="col" className="px-3 py-1.5 text-end font-medium">
                  {table.value}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.key} className="border-border border-t">
                  <th scope="row" className="px-3 py-1.5 text-start font-normal">
                    {point.label}
                  </th>
                  <td className="px-3 py-1.5 text-end tabular-nums">
                    {point.value === null ? "—" : formatValue(point.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
