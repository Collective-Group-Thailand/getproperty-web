/**
 * Copies the five woff2 files the design system ships (ADR-0001) from the `@fontsource-variable/*`
 * packages into `src/ui/fonts/files/`, where `next/font/local` and Storybook read them.
 *
 *   pnpm fonts            copy (also runs on `postinstall`)
 *   pnpm fonts --check    fail if a committed file differs from the package's
 *
 * The files are committed as well, so a checkout builds without running this; the script exists so
 * a font upgrade is `pnpm up @fontsource-variable/* && pnpm fonts` and never a hand copy. Google Fonts
 * is never fetched at build or run time — the registry is the only network the fonts ever need.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/fonts/files");

/** Package → the subset file inside its `files/` → the name the app knows it by. */
const FONTS: { pkg: string; file: string; as: string }[] = [
  {
    pkg: "@fontsource-variable/noto-sans-thai",
    file: "noto-sans-thai-thai-wght-normal.woff2",
    as: "noto-sans-thai-thai.woff2",
  },
  {
    pkg: "@fontsource-variable/noto-sans-thai",
    file: "noto-sans-thai-latin-wght-normal.woff2",
    as: "noto-sans-thai-latin.woff2",
  },
  { pkg: "@fontsource-variable/anuphan", file: "anuphan-thai-wght-normal.woff2", as: "anuphan-thai.woff2" },
  { pkg: "@fontsource-variable/anuphan", file: "anuphan-latin-wght-normal.woff2", as: "anuphan-latin.woff2" },
  {
    pkg: "@fontsource-variable/jetbrains-mono",
    file: "jetbrains-mono-latin-wght-normal.woff2",
    as: "jetbrains-mono-latin.woff2",
  },
];

function packageDir(pkg: string): string {
  return dirname(require.resolve(`${pkg}/package.json`));
}

function main(): void {
  const check = process.argv.includes("--check");
  mkdirSync(OUT, { recursive: true });
  let stale = 0;
  for (const font of FONTS) {
    let source: string;
    try {
      source = join(packageDir(font.pkg), "files", font.file);
    } catch {
      // `pnpm install --prod` or a partial install: nothing to copy from, and the committed files serve.
      process.stdout.write(`skip ${font.as} (${font.pkg} not installed)\n`);
      continue;
    }
    const target = join(OUT, font.as);
    if (check) {
      const same = existsSync(target) && readFileSync(source).equals(readFileSync(target));
      if (!same) stale += 1;
      process.stdout.write(`${same ? "ok   " : "STALE"} ${font.as}\n`);
      continue;
    }
    copyFileSync(source, target);
    process.stdout.write(`copied ${font.as}\n`);
  }
  if (stale) {
    process.stderr.write(`${stale} font file(s) differ from the installed packages — run pnpm fonts\n`);
    process.exit(1);
  }
}

main();
