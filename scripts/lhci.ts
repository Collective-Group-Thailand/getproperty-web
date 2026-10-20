/**
 * Runs Lighthouse CI once per URL set (`docs/performance-budgets.md`).
 *
 * `lhci autorun` takes one config, and the budgets differ per route type — 180 KB of initial JS on a
 * staff page, 250 KB on an owner list — so each set is its own config in `lighthouse/`, they share
 * `lighthouse/shared.json`, and this runs them in turn against one production server that answers
 * all three hosts.
 *
 *   pnpm lhci                 every set
 *   pnpm lhci owner staff     named sets only
 *   LHCI_PORT=3201 pnpm lhci  another port, when 3200 is taken
 *   LHCI_CHROME_FLAGS="--headless=new --no-sandbox" pnpm lhci   Chrome as root (containers)
 *
 * Needs a prior `pnpm build`. Not part of `pnpm test`; CI runs it in its own job.
 *
 * The app runs against the mock API (mocks/server.ts) so every run measures the same data. Console
 * sets are measured signed in: this script signs the set's persona in on the mock API and gives
 * Lighthouse the session as a `Cookie` header (`settings.extraHeaders`) — the same httpOnly cookies the
 * browser would hold.
 */

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.LHCI_PORT ?? 3200);
const MOCK_PORT = Number(process.env.LHCI_MOCK_API_PORT ?? 4310);
const MOCK_API = `http://127.0.0.1:${MOCK_PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const SETS = process.argv.slice(2);

const env = {
  ...process.env,
  OWNER_HOST: `localhost:${PORT}`,
  STAFF_HOST: `staff.localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  API_INTERNAL_URL: MOCK_API,
  MOCK_API_PORT: String(MOCK_PORT),
  // Lighthouse sends one fixed session cookie for the whole set (no refresh): keep it valid for the run.
  MOCK_ACCESS_TTL_MS: String(3 * 3600_000),
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

/** Which mock persona each console set is measured as (mocks/README.md). */
const SESSIONS: Record<string, () => Promise<string>> = {
  owner: () => operatorSession("+66810000001"),
  staff: () => operatorSession("+66810000004"),
  admin: () => platformSession("ops@example.com"),
};

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  // A fresh connection per call: a pooled keep-alive socket the mock closed minutes ago fails with EPIPE.
  const response = await fetch(`${MOCK_API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as Record<string, unknown>;
}

const cookieHeader = (pair: Record<string, unknown>, extra = "") =>
  `__Host-gp_at=${String(pair.accessToken)}; __Host-gp_rt=${String(pair.refreshToken)}${extra}`;

async function operatorSession(phone: string): Promise<string> {
  const challenge = await post("/v1/auth/operator/otp/request", { phone });
  const pair = await post("/v1/auth/operator/otp/verify", { challengeId: challenge.challengeId, code: "123456" });
  return cookieHeader(pair, "; __Host-gp_tenant=0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11");
}

async function platformSession(email: string): Promise<string> {
  const pair = await post("/v1/auth/platform/login", {
    email,
    password: "correct horse battery staple",
    totpCode: "123456",
  });
  return cookieHeader(pair);
}

/** The set's config with its URLs on `LHCI_PORT` and its session, written beside the original and removed afterwards. */
async function configFor(name: string): Promise<{ path: string; cleanup: () => void }> {
  const session = SESSIONS[name];
  const extraFlags = process.env.LHCI_CHROME_FLAGS;
  if (PORT === 3200 && !session && !extraFlags) return { path: `lighthouse/${name}.json`, cleanup: () => undefined };
  const path = `lighthouse/.port-${PORT}-${name}.json`;
  const config = JSON.parse(
    readFileSync(join(ROOT, `lighthouse/${name}.json`), "utf8").replaceAll(":3200/", `:${PORT}/`),
  ) as {
    extends?: string;
    ci: { collect: { settings?: Record<string, unknown> } };
  };
  if (session) {
    config.ci.collect.settings = {
      ...config.ci.collect.settings,
      extraHeaders: JSON.stringify({ Cookie: await session() }),
    };
  }
  if (extraFlags) {
    // e.g. LHCI_CHROME_FLAGS="--headless=new --no-sandbox" where Chrome runs as root (containers).
    const settings = config.ci.collect.settings ?? {};
    settings.chromeFlags = [settings.chromeFlags, extraFlags].filter(Boolean).join(" ");
    config.ci.collect.settings = settings;
  }
  writeFileSync(join(ROOT, path), JSON.stringify(config, null, 2));
  return { path, cleanup: () => rmSync(join(ROOT, path), { force: true }) };
}

/**
 * Prints the initial JS each URL of the set loaded — Lighthouse's `resource-summary` script transfer
 * size, min–max over the runs — so a budget change in docs/performance-budgets.md quotes a measurement.
 */
function reportScriptSizes(name: string): void {
  const dir = join(ROOT, ".lighthouseci");
  const sizes = new Map<string, number[]>();
  for (const file of readdirSync(dir).filter((entry) => /^lhr-\d+\.json$/.test(entry))) {
    const report = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      requestedUrl: string;
      audits: Record<string, { details?: { items?: { resourceType: string; transferSize: number }[] } }>;
    };
    const script = report.audits["resource-summary"]?.details?.items?.find((item) => item.resourceType === "script");
    if (!script) continue;
    sizes.set(report.requestedUrl, [...(sizes.get(report.requestedUrl) ?? []), script.transferSize]);
  }
  for (const [url, values] of sizes) {
    const kb = (bytes: number) => (bytes / 1024).toFixed(1);
    console.info(`initial JS [${name}] ${url}: ${kb(Math.min(...values))}–${kb(Math.max(...values))} KB`);
  }
}

async function main(): Promise<void> {
  if (await portTaken()) {
    console.error(`Port ${PORT} is already in use. Set LHCI_PORT to a free port.`);
    process.exit(1);
  }
  // Own process groups, so stopping them also stops the node processes pnpm started.
  const mock = spawn("pnpm", ["exec", "tsx", "mocks/server.ts"], { cwd: ROOT, env, stdio: "ignore", detached: true });
  const server = spawn("pnpm", ["start", "-p", String(PORT)], { cwd: ROOT, env, stdio: "ignore", detached: true });
  const stop = () => {
    for (const child of [server, mock]) {
      try {
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  };
  const failures: string[] = [];

  try {
    await waitForServer();
    for (const name of configs) {
      console.info(`\n── lighthouse: ${name} ──`);
      const config = await configFor(name);
      const result = spawnSync("pnpm", ["exec", "lhci", "autorun", `--config=${config.path}`], {
        cwd: ROOT,
        env,
        stdio: "inherit",
      });
      config.cleanup();
      reportScriptSizes(name);
      if (result.status !== 0) failures.push(name);
    }
  } finally {
    stop();
  }

  if (failures.length > 0) {
    console.error(`\nLighthouse budgets failed for: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.info("\nAll Lighthouse URL sets met their budgets.");
}

void main();
