import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TM30_FIELDS } from "./tm30/deadline";

/**
 * The release-fix and B6 screens label contract enums from messages (held reasons, slip reasons, insight and
 * benchmark metrics, e-Tax subject types). A value the contract adds must get a th + en label, or this fails
 * instead of the screen showing a raw key.
 */
const root = join(__dirname, "../../..");
const contract = JSON.parse(readFileSync(join(root, "contract/openapi.json"), "utf8")) as {
  components: { schemas: Record<string, { enum?: string[] }> };
};
const enumOf = (name: string) => contract.components.schemas[name]?.enum ?? [];
const messages = (locale: string, file: string) =>
  JSON.parse(readFileSync(join(root, `src/i18n/messages/${locale}/owner/${file}.json`), "utf8")) as Record<
    string,
    unknown
  >;
const at = (tree: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);

const CASES: [string, string, string, string[]][] = [
  ["PaymentHeldReason", "payments", "held.reason", enumOf("PaymentHeldReason").map((value) => `${value}.title`)],
  ["SlipReason", "payments", "slips.reason", enumOf("SlipReason")],
  ["InsightMetric", "insights", "metric", enumOf("InsightMetric")],
  ["BenchmarkMetric", "insights", "metric", enumOf("BenchmarkMetric")],
  ["EtaxSubjectType", "etax", "subject", enumOf("EtaxSubjectType")],
  ["TM30 required fields", "tm30", "field", [...TM30_FIELDS]],
];

describe.each(["th", "en"])("%s labels", (locale) => {
  it.each(CASES)("%s has a label for every value", (_name, file, prefix, values) => {
    expect(values.length).toBeGreaterThan(0);
    const tree = messages(locale, file);
    for (const value of values) expect(at(tree, `${prefix}.${value}`), `${file}:${prefix}.${value}`).toBeTruthy();
  });
});
