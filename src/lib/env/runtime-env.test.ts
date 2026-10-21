import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * One image for every environment (D-230): collective-infra's `promote.yml` ships the bytes that passed UAT to
 * production without a rebuild, so no environment value may be inlined by `next build`. Next replaces every literal
 * `process.env.NEXT_PUBLIC_…` at build time; this app reads them on the server at run time instead
 * (`src/lib/env/schema.ts`) and hands them to the browser as props or `<html data-*>` attributes.
 */
const ROOT = join(__dirname, "../../..");
const SOURCES = ["src", "next.config.ts"];

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => (name === "generated" ? [] : files(join(path, name))));
}

describe("run-time environment", () => {
  it("no source reads a NEXT_PUBLIC_ variable that next build would inline", () => {
    const offenders = SOURCES.flatMap((source) => files(join(ROOT, source)))
      .filter((file) => /\.(ts|tsx|mts|js|mjs)$/.test(file) && !file.endsWith("runtime-env.test.ts"))
      .filter((file) => /process\.env(\.NEXT_PUBLIC_|\[["'`]NEXT_PUBLIC_)/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
