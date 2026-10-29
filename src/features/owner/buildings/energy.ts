/*
 * Energy insight (G9, D-301): display helpers. The score, metrics and penalties are the API's (model
 * `energy.insight.score_model`, O-036); the console only moves a ratio's decimal point to show it as a percentage
 * and draws the score's arc — it computes no figure of its own.
 */

/** A 0–1 ratio string (`"0.2400"`) as a percentage string (`"24.00"`) — the decimal point moved, no float math. */
export function ratioToPercent(value: string | null): string | null {
  if (value === null || !/^-?\d+(\.\d+)?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const digits = `${whole}${fraction.padEnd(2, "0")}`;
  const point = whole.length + 2;
  const integer = digits.slice(0, point).replace(/^0+(?=\d)/, "");
  const rest = digits.slice(point);
  return `${negative ? "-" : ""}${integer}${rest ? `.${rest}` : ""}`;
}

/** The score arc (0–100) as an SVG stroke-dasharray for a circle of circumference `length`. */
export function scoreArc(score: number, length: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const drawn = (clamped / 100) * length;
  return `${drawn.toFixed(2)} ${(length - drawn).toFixed(2)}`;
}

/** Whether a penalty took points off (`"0.0"` did not). */
export function penalised(points: string): boolean {
  return /[1-9]/.test(points);
}
