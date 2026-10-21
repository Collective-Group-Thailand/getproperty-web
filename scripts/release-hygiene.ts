/**
 * Release hygiene: fails when a production build ships what only development and the mock
 * API should see — the mock API's own markers, the copy that marks mock rows, `debugger`
 * statements, browser source maps — in the client bundles (`.next/static`) or the prerendered HTML
 * (`.next/server/app`), and environment files or mock / test sources in the standalone server the image ships
 * (`.next/standalone`, D-230). Run after `pnpm build`, which never sets `API_MOCKS`.
 *
 * Third-party code that merely references `console.debug` is not a finding; a pattern is listed
 * here only when nothing legitimate in a production build can contain it.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  { dir: ".next/static", ext: [".js", ".css"] },
  { dir: ".next/server/app", ext: [".html", ".rsc"] },
];

const RULES: { name: string; pattern: RegExp }[] = [
  { name: "mock API marker", pattern: /\[MSW\]|mockServiceWorker|setupWorker\(|API_MOCKS/ },
  { name: "mock data copy", pattern: /ข้อมูลจำลอง|\(mock data\)/ },
  { name: "mock scenario switch", pattern: /x-mock-scenario|\?mock=(?:off|on|[a-z-]+)/ },
  { name: "debugger statement", pattern: /\bdebugger\s*;/ },
  { name: "contract-request marker", pattern: /CONTRACT-REQUEST/ },
  { name: "browser source map", pattern: /\/\/# sourceMappingURL=/ },
];

function* files(dir: string, ext: string[]): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path, ext);
    else if (ext.some((e) => name.endsWith(e)) || name.endsWith(".map")) yield path;
  }
}

const findings: string[] = [];
let scanned = 0;
for (const target of TARGETS) {
  const dir = join(ROOT, target.dir);
  if (!existsSync(dir)) {
    console.error(`release-hygiene: ${target.dir} is missing — run \`pnpm build\` first`);
    process.exit(2);
  }
  for (const file of files(dir, target.ext)) {
    scanned++;
    if (file.endsWith(".map") && target.dir === ".next/static") {
      findings.push(`${relative(ROOT, file)}: browser source map shipped`);
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const rule of RULES) {
      const match = rule.pattern.exec(text);
      if (match) {
        const at = Math.max(0, match.index - 40);
        findings.push(
          `${relative(ROOT, file)}: ${rule.name} — …${text.slice(at, match.index + 60).replace(/\s+/g, " ")}…`,
        );
      }
    }
  }
}

// The standalone server is what the platform image ships (D-230, Dockerfile): no environment file (every value
// comes from the platform at run time) and no mock API or test source may be traced into it.
const STANDALONE = join(ROOT, ".next/standalone");
if (existsSync(STANDALONE)) {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === "node_modules") return [];
      return statSync(path).isDirectory() ? [path, ...walk(path)] : [path];
    });
  for (const path of walk(STANDALONE)) {
    const rel = relative(STANDALONE, path);
    scanned++;
    if (/(^|\/)\.env(\.|$)/.test(rel)) findings.push(`.next/standalone/${rel}: environment file in the image`);
    if (/^(mocks|e2e|\.integration)(\/|$)/.test(rel))
      findings.push(`.next/standalone/${rel}: test or mock source in the image`);
  }
}

if (findings.length) {
  console.error(`release-hygiene: ${findings.length} finding(s) in ${scanned} files`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log(`release-hygiene: ${scanned} files clean`);
