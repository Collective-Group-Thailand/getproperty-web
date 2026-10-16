/**
 * Runs Lighthouse CI once per URL set (`docs/performance-budgets.md`).
 *
 * `lhci autorun` takes one config, and the budgets differ per route type — 150 KB of initial JS on a
 * tenant page, 250 KB on an owner list — so each set is its own config in `lighthouse/`, they share
 * `lighthouse/shared.json`, and this runs them in turn against one production server that answers
 * all four hosts.
 *
 *   pnpm lhci                 every set
 *   pnpm lhci owner tenant    named sets only
 *   LHCI_PORT=3201 pnpm lhci  another port, when 3200 is taken
 *
 * Needs a prior `pnpm build`. Not part of `pnpm test`; CI runs it in its own job from F1.
 */

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.LHCI_PORT ?? 3200);
const ROOT = new URL("..", import.meta.url).pathname;
const SETS = process.argv.slice(2);

const env = {
  ...process.env,
  OWNER_HOST: `localhost:${PORT}`,
  TENANT_HOST: `tenant.localhost:${PORT}`,
  STAFF_HOST: `staff.localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  // F1: mock mode, so Lighthouse measures the same thing every time and the zones have a session.
  API_MOCKS: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};

async function portTaken(): Promise<boolean> {
  try {
    await fetch(`http://localhost:${PORT}/`);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await portTaken()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The server did not come up on port ${PORT}.`);
}

const configs = readdirSync(join(ROOT, "lighthouse"))
  .filter((file) => file.endsWith(".json") && file !== "shared.json" && !file.startsWith("."))
  .map((file) => file.replace(/\.json$/, ""))
  .filter((name) => SETS.length === 0 || SETS.includes(name));

if (configs.length === 0) {
  console.error(`No URL set matched ${SETS.join(", ")}. Available: see lighthouse/*.json`);
  process.exit(1);
}

/** The set's config with its URLs on `LHCI_PORT`, written beside the original and removed afterwards. */
function configFor(name: string): { path: string; cleanup: () => void } {
  if (PORT === 3200) return { path: `lighthouse/${name}.json`, cleanup: () => undefined };
  const path = `lighthouse/.port-${PORT}-${name}.json`;
  writeFileSync(
    join(ROOT, path),
    readFileSync(join(ROOT, `lighthouse/${name}.json`), "utf8").replaceAll(":3200/", `:${PORT}/`),
  );
  return { path, cleanup: () => rmSync(join(ROOT, path), { force: true }) };
}

async function main(): Promise<void> {
  if (await portTaken()) {
    console.error(`Port ${PORT} is already in use. Set LHCI_PORT to a free port.`);
    process.exit(1);
  }
  const server = spawn("pnpm", ["start", "-p", String(PORT)], { cwd: ROOT, env, stdio: "ignore" });
  const failures: string[] = [];

  try {
    await waitForServer();
    for (const name of configs) {
      console.info(`\n── lighthouse: ${name} ──`);
      const config = configFor(name);
      const result = spawnSync("pnpm", ["exec", "lhci", "autorun", `--config=${config.path}`], {
        cwd: ROOT,
        env,
        stdio: "inherit",
      });
      config.cleanup();
      if (result.status !== 0) failures.push(name);
    }
  } finally {
    server.kill();
  }

  if (failures.length > 0) {
    console.error(`\nLighthouse budgets failed for: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.info("\nAll Lighthouse URL sets met their budgets.");
}

void main();
