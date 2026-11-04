/**
 * The shape of a platform setting's value (redesign G8: typed controls, never raw JSON). The catalogue is open-ended,
 * so the shape is read from the value the API returns: a scalar, a map of scalars (one per customer type, per document
 * kind…), a list of scalars, or something richer that has its own page. Nothing is computed from a value.
 */
export type SettingShape =
  | { kind: "scalar" }
  | { kind: "map"; entries: { key: string; type: "number" | "decimal" | "bool" | "text"; nullable: boolean }[] }
  | { kind: "list"; type: "number" | "text" }
  | { kind: "complex" };

type Scalar = string | number | boolean | null;
const isScalar = (value: unknown): value is Scalar =>
  value === null || ["string", "number", "boolean"].includes(typeof value);
const DECIMAL = /^-?\d+(\.\d+)?$/;

export function settingShape(value: unknown, valueType: string): SettingShape {
  if (valueType !== "json") return { kind: "scalar" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "complex" };
    if (value.every((item) => typeof item === "number")) return { kind: "list", type: "number" };
    if (value.every((item) => typeof item === "string")) return { kind: "list", type: "text" };
    return { kind: "complex" };
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 || !entries.every(([, item]) => isScalar(item))) return { kind: "complex" };
    const sample = entries.map(([, item]) => item).find((item) => item !== null);
    return {
      kind: "map",
      entries: entries.map(([key, item]) => ({
        key,
        nullable: entries.some(([, other]) => other === null),
        type:
          typeof (item ?? sample) === "boolean"
            ? "bool"
            : typeof (item ?? sample) === "number"
              ? "number"
              : typeof (item ?? sample) === "string" && DECIMAL.test(String(item ?? sample))
                ? "decimal"
                : item === null && sample === undefined
                  ? "decimal"
                  : "text",
      })),
    };
  }
  return { kind: "scalar" };
}

/** Reads a typed map or list back from the form (`value.<key>`, `value.<index>`); `undefined` when a field is invalid. */
export function readShape(shape: SettingShape, data: FormData): unknown {
  if (shape.kind === "map") {
    const out: Record<string, Scalar> = {};
    for (const entry of shape.entries) {
      const raw = String(data.get(`value.${entry.key}`) ?? "").trim();
      if (entry.type === "bool") out[entry.key] = data.get(`value.${entry.key}`) === "on";
      else if (raw === "") {
        if (!entry.nullable) return undefined;
        out[entry.key] = null;
      } else if (entry.type === "number") {
        if (!/^-?\d+(\.\d+)?$/.test(raw)) return undefined;
        out[entry.key] = Number(raw);
      } else if (entry.type === "decimal") {
        if (!DECIMAL.test(raw)) return undefined;
        out[entry.key] = raw;
      } else out[entry.key] = raw;
    }
    return out;
  }
  if (shape.kind === "list") {
    const items = data
      .getAll("value.item")
      .map((item) => String(item).trim())
      .filter(Boolean);
    if (shape.type === "number") {
      if (!items.every((item) => /^-?\d+(\.\d+)?$/.test(item))) return undefined;
      return items.map(Number);
    }
    return items;
  }
  return undefined;
}
