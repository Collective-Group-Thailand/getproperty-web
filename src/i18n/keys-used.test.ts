import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { MESSAGE_FILES } from "./messages";

const LOCALES = ["th", "en"] as const;
const messagesDir = join(__dirname, "messages");
const srcDir = join(__dirname, "..");

/** The message tree the way `request.ts` assembles it: common files at the top, zone files under the zone key. */
function tree(locale: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [area, files] of Object.entries(MESSAGE_FILES)) {
    const target = area === "common" ? root : ((root[area] = {}) as Record<string, unknown>);
    for (const file of files)
      target[file] = JSON.parse(readFileSync(join(messagesDir, locale, area, `${file}.json`), "utf8")) as unknown;
  }
  return root;
}

const lookup = (node: unknown, path: string) =>
  path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], node);

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });

/**
 * Every literal key a component passes to its translator resolves to a message string. A key that names a group
 * (an object) renders nothing and logs `FORMATTING_ERROR: a is not iterable` at runtime — `storage.files` became a
 * group in G1 while the storage card still asked for it as a label. Only translators bound once per file with a
 * literal namespace are checked; dynamic keys (`t(\`kind.${x}\`)`) are covered by the enum label tests.
 */
describe("translation keys used in components", () => {
  const messages = Object.fromEntries(LOCALES.map((locale) => [locale, tree(locale)]));
  const files = sources(srcDir).filter((file) => !file.includes(`${join("i18n", "messages")}`));

  it("finds translators to check", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("resolve to a message string in th and en", () => {
    const problems: string[] = [];
    let checked = 0;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const bindings = new Map<string, Set<string>>();
      for (const [, name, namespace] of text.matchAll(
        /const (\w+) = (?:await )?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g,
      ))
        bindings.set(name!, (bindings.get(name!) ?? new Set()).add(namespace!));
      for (const [name, namespaces] of bindings) {
        // bound more than once, or also bound some other way (destructured from Promise.all) — not unambiguous
        if (namespaces.size !== 1 || new RegExp(`[[,]\\s*${name}\\s*[\\],]`).test(text)) continue;
        const namespace = [...namespaces][0]!;
        for (const [, key] of text.matchAll(new RegExp(`\\b${name}(?:\\.rich|\\.markup)?\\(\\s*"([^"]+)"`, "g"))) {
          checked++;
          for (const locale of LOCALES) {
            const value = lookup(messages[locale], `${namespace}.${key}`);
            if (typeof value !== "string")
              problems.push(`${relative(srcDir, file)}: ${namespace}.${key} (${locale}) is ${typeof value}`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(problems).toEqual([]);
  });
});
