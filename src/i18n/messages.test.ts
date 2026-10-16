import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dir = join(__dirname, "messages");

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

/** Every key in Thai exists in English and vice versa, so no screen is half-translated. */
describe("messages", () => {
  const files = readdirSync(join(dir, "th"));
  it.each(files)("%s has the same keys in th and en", (file) => {
    const th = JSON.parse(readFileSync(join(dir, "th", file), "utf8"));
    const en = JSON.parse(readFileSync(join(dir, "en", file), "utf8"));
    expect(keys(en).sort()).toEqual(keys(th).sort());
  });
  it("has one file per zone plus shared", () => {
    expect(files.sort()).toEqual(["admin.json", "owner.json", "shared.json", "staff.json"]);
  });
});
