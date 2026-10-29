import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";

import { MESSAGE_FILES } from "./messages";

const dir = join(__dirname, "messages");
const LOCALES = ["th", "en"] as const;

function entries(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [[prefix, String(value)]];
  return Object.entries(value).flatMap(([k, v]) => entries(v, prefix ? `${prefix}.${k}` : k));
}

const read = (locale: string, area: string, file: string) =>
  JSON.parse(readFileSync(join(dir, locale, area, `${file}.json`), "utf8")) as unknown;

const pairs = Object.entries(MESSAGE_FILES).flatMap(([area, files]) => files.map((file) => [area, file] as const));

/** Every key in Thai exists in English and vice versa, so no screen is half-translated. */
describe("messages", () => {
  it.each(pairs)("%s/%s has the same keys in th and en", (area, file) => {
    const th = entries(read("th", area, file)).map(([k]) => k);
    const en = entries(read("en", area, file)).map(([k]) => k);
    expect(en.sort()).toEqual(th.sort());
  });

  // Review M2: next-intl splits keys on "." — a dotted key never resolves and the raw path shows instead.
  it.each(LOCALES.flatMap((locale) => pairs.map(([area, file]) => [locale, area, file] as const)))(
    "%s/%s/%s has no key containing a dot (look codes up with messageKey)",
    (locale, area, file) => {
      const dotted: string[] = [];
      const walk = (value: unknown, path: string) => {
        if (typeof value !== "object" || value === null) return;
        for (const [key, child] of Object.entries(value)) {
          if (key.includes(".")) dotted.push(`${path}[${key}]`);
          walk(child, path ? `${path}.${key}` : key);
        }
      };
      walk(read(locale, area, file), "");
      expect(dotted).toEqual([]);
    },
  );

  it("the file list in messages.ts matches the files on disk", () => {
    for (const locale of LOCALES) {
      const areas = readdirSync(join(dir, locale)).sort();
      expect(areas).toEqual(Object.keys(MESSAGE_FILES).sort());
      for (const area of areas) {
        const files = readdirSync(join(dir, locale, area))
          .map((name) => name.replace(/\.json$/, ""))
          .sort();
        expect(files, `${locale}/${area}`).toEqual([...MESSAGE_FILES[area as keyof typeof MESSAGE_FILES]].sort());
      }
    }
  });

  it("has no resident-app languages or zones here (D-154)", () => {
    expect(readdirSync(dir).sort()).toEqual(["en", "th"]);
    for (const locale of LOCALES) {
      expect(existsSync(join(dir, locale, "tenant"))).toBe(false);
      expect(existsSync(join(dir, locale, "resident"))).toBe(false);
    }
  });

  it.each(LOCALES.flatMap((locale) => pairs.map(([area, file]) => [locale, area, file] as const)))(
    "%s/%s/%s parses as ICU MessageFormat",
    (locale, area, file) => {
      for (const [key, message] of entries(read(locale, area, file))) {
        expect(() => new IntlMessageFormat(message, locale), key).not.toThrow();
      }
    },
  );
});

describe("glossary", () => {
  const contract = JSON.parse(readFileSync(join(__dirname, "../../contract/openapi.json"), "utf8")) as {
    components: { schemas: Record<string, { enum?: string[] }> };
  };
  it.each([
    ["tenantType", "TenantType"],
    ["tenantRole", "TenantRole"],
    ["platformRole", "PlatformRole"],
  ])("glossary.%s names every value of the contract enum %s in th and en", (key, component) => {
    const values = contract.components.schemas[component]?.enum ?? [];
    expect(values.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      const glossary = read(locale, "common", "glossary") as Record<string, Record<string, string>>;
      expect(Object.keys(glossary[key] ?? {}).sort()).toEqual([...values].sort());
    }
  });

  // A label map keyed by a contract enum must name every value, or a new value shows up as a MISSING_MESSAGE.
  it.each([
    ["common", "console", "platformInvoice.lineKind", "PlatformLineKind"],
    ["common", "console", "platformInvoice.method", "PlatformPaymentMethod"],
  ])("%s/%s %s labels every value of the contract enum %s in th and en", (area, file, path, component) => {
    const values = contract.components.schemas[component]?.enum ?? [];
    expect(values.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      const labels = path
        .split(".")
        .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], read(locale, area, file));
      const missing = values.filter((value) => typeof (labels as Record<string, unknown>)?.[value] !== "string");
      expect(missing, `${locale}: ${path}`).toEqual([]);
    }
  });
});
