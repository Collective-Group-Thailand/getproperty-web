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

describe("layout rules", () => {
  it("every scroll container is positioned, so absolutely positioned children (sr-only labels) never widen the page", () => {
    // An `overflow-*-auto` box that is not a containing block lets `position: absolute` descendants escape its clip;
    // a table's `sr-only` header then made the whole console scroll sideways on a 390-px phone (2026-10-25).
    expect(
      scan(ui, /\boverflow-(x-)?auto\b/, (_file, text) => /\b(relative|absolute|fixed|sticky)\b/.test(text)),
    ).toEqual([]);
  });
});

/**
 * The design language of the redesign (docs/design/REDESIGN-PROMPT.md §3), held in CI. `LEGACY` lists the files that
 * still break a rule on 2026-11-03 — each work group takes its files out when it rebuilds them; nothing may be added.
 */
const LEGACY: Record<string, string[]> = {
  darkBlock: [
    "src/app/[locale]/(marketing)/page.tsx",
    "src/app/[locale]/(marketing)/landlords/page.tsx",
    "src/app/[locale]/(marketing)/guides/[slug]/page.tsx",
    "src/app/[locale]/(marketing)/help/page.tsx",
    "src/app/[locale]/(marketing)/about/page.tsx",
    "src/features/owner/marketing/tools/RentalYieldTool.tsx",
  ],
  stripe: ["src/features/owner/marketing/guides/GuideBlocks.tsx"],
  unfinished: ["src/i18n/messages/th/owner/marketing.json", "src/i18n/messages/en/owner/marketing.json"],
};

const messages = files("src/i18n/messages", /\.json$/);

function offenders(
  paths: string[],
  pattern: RegExp,
  legacy: string[] = [],
  allow?: (file: string, text: string) => boolean,
) {
  return scan(paths, pattern, allow).filter((line) => !legacy.some((file) => line.startsWith(`${file}:`)));
}

describe("design language bans", () => {
  it("draws no pill: rounded-full only on squares (size-*) and on tracks (switch, progress, sheet handle, bars)", () => {
    const tracks = [
      "src/ui/components/Switch.tsx",
      "src/ui/components/Progress.tsx",
      "src/ui/components/Sheet.tsx",
      "src/ui/components/Stepper.tsx",
      "src/ui/components/CountBadge.tsx",
      "src/features/owner/marketing/listings/ListingReviews.tsx",
    ];
    expect(
      offenders(ui, /\brounded-full\b/, [], (file, text) => tracks.includes(file) || /\bsize-/.test(text)),
    ).toEqual([]);
  });

  it("uses only the four radius tokens (thumb, control, card, panel) and no literal border-radius", () => {
    expect(scan(ui, /\brounded(-[a-z]{1,2})?-(sm|md|lg|xl|2xl|3xl|photo)\b/)).toEqual([]);
    // The offline page is bare (no stylesheet): its one literal radius is the control token (10 px).
    expect(
      scan(
        ui,
        /border-radius\s*:/i,
        (file, text) => /var\(--radius-/.test(text) || file === "src/app/staff/offline/route.ts",
      ),
    ).toEqual([]);
  });

  it("has no large dark blocks: the ink colour is text, never a section background", () => {
    expect(offenders(ui, /\bbg-fg\b(?!\/)/, LEGACY.darkBlock)).toEqual([]);
  });

  it("has no rotated stamps and no stripe-coloured cards", () => {
    expect(scan(ui, /(^|[\s"'`])-?rotate-\d/)).toEqual([]);
    expect(offenders(ui, /\bborder-[sel]-[3-9]\b/, LEGACY.stripe)).toEqual([]);
  });

  it("loads no icon font and shows no keyboard hints (⌘K, Ctrl K)", () => {
    expect(scan(ui, /material-(symbols|icons)/)).toEqual([]);
    expect(scan(messages, /⌘|\bCtrl\s?K\b/)).toEqual([]);
  });

  it("ships no 'coming soon' / beta badges and no 'AI-generated' claims", () => {
    expect(offenders(messages, /coming soon|\bbeta\b|กำลังพัฒนา|เร็ว ๆ นี้|เร็วๆ นี้/i, LEGACY.unfinished)).toEqual([]);
    expect(scan(messages, /AI-generated|generated by AI|สร้างโดย AI|สร้างด้วย AI/i)).toEqual([]);
  });
});
