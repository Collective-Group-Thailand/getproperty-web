// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The type rules, held in CI rather than in reviewers' memory (founder 2026-10-24: "one font for the whole system,
 * sizes easy to adjust — as in getpack partner"). Every size comes from the scale in src/ui/tokens/scale.ts and every
 * screen is set in the one typeface; a pattern that would break that fails here with its file:line.
 */
const root = fileURLToPath(new URL("../../", import.meta.url));

function files(dir: string, extensions: RegExp): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return name === "generated" ? [] : files(path, extensions);
    return extensions.test(name) ? [path] : [];
  });
}

function scan(paths: string[], pattern: RegExp, allow: (file: string, text: string) => boolean = () => false) {
  return paths.flatMap((file) =>
    readFileSync(join(root, file), "utf8")
      .split("\n")
      .flatMap((text, index) =>
        pattern.test(text) && !allow(file, text) ? [`${file}:${index + 1}  ${text.trim().slice(0, 140)}`] : [],
      ),
  );
}

const SELF = relative(root, fileURLToPath(import.meta.url));
const ui = files("src", /\.(tsx?|css)$/).filter(
  (file) => file !== SELF && !file.endsWith("schema.d.ts") && !/\.(test|stories)\.tsx?$/.test(file),
);

describe("type rules", () => {
  it("has one typeface (Anuphan) and the mono face for figures — no other family is named or loaded", () => {
    // The two pages that render with no design system at all (global error, staff offline) fall back to system-ui.
    const bare = ["src/app/global-error.tsx", "src/app/staff/offline/route.ts"];
    expect(scan(ui, /noto|trirong|sarabun|kanit|serif-thai|font-editorial/i)).toEqual([]);
    expect(
      scan(
        ui,
        /font-?family\s*:/i,
        (file, text) => bare.includes(file) || /var\(--font-(sans|display|mono)\)/.test(text),
      ),
    ).toEqual([]);
    const fonts = readdirSync(join(root, "src/ui/fonts/files")).sort();
    expect(fonts).toEqual(["anuphan-latin.woff2", "anuphan-thai.woff2", "jetbrains-mono-latin.woff2"]);
  });

  it("takes every text size from the scale: no text-[…] and no Tailwind step outside it", () => {
    expect(scan(ui, /\btext-\[\d/)).toEqual([]);
    expect(scan(ui, /\btext-(5xl|6xl|7xl|8xl|9xl)\b/)).toEqual([]);
    expect(
      scan(ui, /font-size\s*:/i, (file, text) => /var\(--text-[a-z0-9]+\)/.test(text) || file.endsWith("route.ts")),
    ).toEqual([]);
  });

  it("takes every radius from the tokens and draws no gradient", () => {
    expect(scan(ui, /\brounded(-[a-z]+)?-\[/)).toEqual([]);
    expect(scan(ui, /\bbg-(gradient|linear|radial|conic)-|(linear|radial|conic)-gradient\(/)).toEqual([]);
  });
});
