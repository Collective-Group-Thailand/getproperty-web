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
  className?: string;
  "data-testid"?: string;
}

const WIDTH = 640;
const PAD = { top: 12, right: 12, bottom: 28, left: 64 };

/**
 * A tokenised line or bar chart drawn as SVG on the server (design-system.md §3 "Charts"): no chart
 * library and no client JavaScript (D-179 — the owner budget is 260 KB), hover text from SVG `<title>`,
 * and the **data-table fallback** every chart must have (§6) in a native `<details>` right under it.
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
  className,
  "data-testid": testId,
}: ChartProps) {
  const values = points.map((point) => (point.value === null ? null : Number.parseFloat(point.value)));
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const empty = finite.length === 0;
  const max = empty ? 1 : Math.max(...finite, 0);
  const min = empty ? 0 : Math.min(...finite, 0);
  const span = max - min || 1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const step = points.length > 1 ? plotW / (type === "bar" ? points.length : points.length - 1) : plotW;
  const x = (index: number) => PAD.left + (type === "bar" ? step * index + step / 2 : step * index);
  const y = (value: number) => PAD.top + plotH - ((value - min) / span) * plotH;
  const ticks = [0, 1, 2, 3].map((index) => min + (span * index) / 3);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const tip = (index: number) => [points[index]!.label, formatValue(points[index]!.value!)].join(": ");

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
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label={title}
          className="h-auto w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                strokeDasharray="3 3"
              />
              <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted text-2xs tabular-nums">
                {formatValue(tick.toFixed(2))}
              </text>
            </g>
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
                    rx={3}
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
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
          {type === "line"
            ? values.map((value, index) =>
                value === null || !Number.isFinite(value) ? null : (
                  <circle key={points[index]!.key} cx={x(index)} cy={y(value)} r={3} className="fill-primary">
                    <title>{tip(index)}</title>
                  </circle>
                ),
              )
            : null}
          {points.map((point, index) =>
            index % labelEvery === 0 ? (
              <text
                key={point.key}
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted text-2xs tabular-nums"
              >
                {point.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
      <details className="text-sm">
        <summary className="text-primary w-fit cursor-pointer font-medium">{table.summary}</summary>
        <div className="border-border mt-2 max-h-72 overflow-auto rounded-md border">
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
