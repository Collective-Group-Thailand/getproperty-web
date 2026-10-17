/**
 * The real getproperty-api for the `integration` Playwright project (`pnpm e2e:integration`).
 *
 *   1. Exports getproperty-api at the commit pinned in contract.lock.json (`apiCommit`) with
 *      `git archive` into `.integration/api-<commit>` — never the sibling's working tree, which another
 *      session may be editing — links its node_modules, generates the Prisma client and builds it (swc).
 *   2. Starts an embedded PostgreSQL 18 with the API's own `scripts/local-pg.mjs` (`pnpm db:local`),
 *      recreates the `getproperty_webint` database, runs the asset-core migrations, the API's SQL
 *      migrations (the same runner as its integration suite) and the dev seed.
 *   3. Boots the API in this process with `DATA_STORES_MODE=real` (PostgreSQL real; Redis/MQTT
 *      in-memory) and `INTEGRATIONS_MODE=fake`, listening on INT_API_PORT (4210).
 *   4. Onboards a tenant through the admin API (platform sign-in with TOTP enrolment, D-164) whose
 *      first Owner is +66810000001, and serves a side channel on INT_CONTROL_PORT (4211) for the suite:
 *      `GET /health`, `GET /invitation` (the onboarding invitation), `GET /sms/last-code?phone=` (the
 *      fake SMS outbox), `GET /totp?secret=` (an authenticator code).
 *
 * Nothing here is part of the app: it exists so the suite can run the real sign-in flows once.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chownSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const API_REPO = resolve(WEB, process.env.INT_API_REPO ?? "../getproperty-api");
const WORK = resolve(WEB, ".integration");
const API_PORT = Number(process.env.INT_API_PORT ?? 4210);
const CONTROL_PORT = Number(process.env.INT_CONTROL_PORT ?? 4211);
const PG_PORT = Number(process.env.INT_PG_PORT ?? 55440);
const DB = "getproperty_webint";
const OWNER_PHONE = "+66810000001";
const ADMIN_EMAIL = "admin@getproperty.invalid";

const log = (...args: unknown[]) => console.info("[integration]", ...args);

/** The slices of `pg` and `@nestjs/core` used here (they are getproperty-api's dependencies, not ours). */
interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<unknown>;
}
type PgModule = { Client: new (options: { connectionString: string }) => PgClient };
interface NestApp {
  listen(port: number, host: string): Promise<unknown>;
  get<T>(token: unknown): T;
}
type NestCore = { NestFactory: { create(module: unknown, options: Record<string, unknown>): Promise<NestApp> } };

function run(command: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

/** 1. The pinned API commit, exported and built once per commit. */
function prepareApi(): string {
  const lock = JSON.parse(readFileSync(join(WEB, "contract.lock.json"), "utf8")) as { apiCommit?: string };
  const commit = (process.env.INT_API_COMMIT ?? lock.apiCommit ?? "").replace(/\+dirty$/, "");
  if (!commit) throw new Error("contract.lock.json has no apiCommit; adopt the contract from a getproperty-api commit");
  const dir = join(WORK, `api-${commit}`);
  if (existsSync(join(dir, "dist/src/app.module.js"))) return dir;

  log(`exporting getproperty-api@${commit} into ${dir}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const archive = execFileSync("git", ["-C", API_REPO, "archive", "--format=tar", commit], {
    maxBuffer: 512 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", dir], { input: archive });
  symlinkSync(join(API_REPO, "node_modules"), join(dir, "node_modules"), "dir");
  run(process.execPath, ["scripts/prisma-generate.mjs"], dir);
  run(
    join(dir, "node_modules/.bin/swc"),
    [
      "src",
      "scripts",
      "prisma/seed",
      "-d",
      "dist",
      "--config-file",
      ".swcrc",
      "--copy-files",
      "--ignore",
      "**/*.spec.ts",
      "--quiet",
    ],
    dir,
  );
  run("cp", ["package.json", "dist/package.json"], dir);
  return dir;
}

/** 2. Embedded PostgreSQL via the API's `pnpm db:local`, then migrations and the dev seed. */
async function startDatabase(apiDir: string): Promise<{ child: ChildProcess; url: string }> {
  const parent = join(WORK, "pg");
  mkdirSync(parent, { recursive: true });
  if (process.getuid?.() === 0) {
    const uid = Number(execFileSync("id", ["-u", "postgres"]).toString().trim());
    const gid = Number(execFileSync("id", ["-g", "postgres"]).toString().trim());
    chownSync(parent, uid, gid);
  }
  const child = spawn(process.execPath, ["scripts/local-pg.mjs", "start"], {
    cwd: apiDir,
    env: { ...process.env, LOCAL_PG_DIR: join(parent, "data"), LOCAL_PG_PORT: String(PG_PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("PostgreSQL did not start in 120 s")), 120_000);
    child.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes("PostgreSQL ready")) {
        clearTimeout(timer);
        ready();
      }
    });
    child.once("exit", (code) => fail(new Error(`db:local exited with ${code}`)));
  });

  const require = createRequire(join(apiDir, "package.json"));
  const { Client } = require("pg") as PgModule;
  const admin = new Client({ connectionString: `postgresql://gp:gp@127.0.0.1:${PG_PORT}/postgres` });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();

  const url = `postgresql://gp:gp@127.0.0.1:${PG_PORT}/${DB}`;
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const assetCore = (await import(pathToFileURL(require.resolve("@collective/asset-core")).href)) as {
      assetCoreMigrate: (options: { client: unknown }) => Promise<unknown>;
    };
    await assetCore.assetCoreMigrate({ client: db });
    await applyMigrations(db, join(apiDir, "prisma/migrations"));
    const seed = require(join(apiDir, "dist/prisma/seed/run.js")) as {
      runSeed: (client: unknown, mode: "dev") => Promise<unknown>;
    };
    await seed.runSeed(db, "dev");
  } finally {
    await db.end();
  }
  log(`database ${DB} migrated and seeded`);
  return { child, url };
}

/** The API's SQL migrations in order, recorded like `prisma migrate deploy` (its integration suite does the same). */
async function applyMigrations(db: PgClient, dir: string) {
  await db.query(`CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
  for (const name of readdirSync(dir)
    .filter((d) => /^\d{14}_/.test(d))
    .sort()) {
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query(
        `INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, now(), 1)`,
        [randomUUID(), createHash("sha256").update(sql).digest("hex"), name],
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw new Error(`migration ${name} failed: ${(error as Error).message}`);
    }
  }
}

/** 3. The API itself, in this process, so the fake SMS outbox is reachable. */
async function startApi(apiDir: string, databaseUrl: string) {
  Object.assign(process.env, {
    NODE_ENV: "development",
    PORT: String(API_PORT),
    INTEGRATIONS_MODE: "fake",
    DATA_STORES_MODE: "real",
    REDIS_MODE: "fake",
    MQTT_MODE: "fake",
    DATABASE_URL: databaseUrl,
    DATABASE_APP_ROLE: "gp_app",
    DATABASE_PLATFORM_ROLE: "gp_platform",
    LOG_LEVEL: process.env.INT_DEBUG ? "info" : "warn",
    LOG_PRETTY: "false",
    THROTTLE_LIMIT: "100000",
    AUTH_THROTTLE_LIMIT: "100000",
    S3_BUCKET: "getproperty-webint",
    PUBLIC_WEB_APP_URL: "http://localhost:3200",
  });
  const require = createRequire(join(apiDir, "package.json"));
  const { NestFactory } = require("@nestjs/core") as NestCore;
  const { AppModule } = require(join(apiDir, "dist/src/app.module.js")) as { AppModule: new () => unknown };
  const { configureApp } = require(join(apiDir, "dist/src/bootstrap.js")) as { configureApp: (app: unknown) => void };
  const { SMS } = require(join(apiDir, "dist/src/integrations/sms/sms.port.js")) as { SMS: symbol | string };
  const { totpAt } = require(join(apiDir, "dist/src/core/identity/crypto/totp.js")) as {
    totpAt: (secret: string, at: Date) => string;
  };
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"], abortOnError: false });
  configureApp(app);
  await app.listen(API_PORT, "127.0.0.1");
  log(`getproperty-api listening on http://127.0.0.1:${API_PORT}`);
  const sms = app.get<{ lastCodeTo(phone: string): string | undefined }>(SMS);
  return { app, sms, totpAt };
}

/** 4. A tenant whose first Owner signs in through the web app with the invitation (D-145). */
async function onboardTenant(totpAt: (secret: string, at: Date) => string) {
  const api = `http://127.0.0.1:${API_PORT}`;
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`${api}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  };
  const password = "getproperty-dev-only-password";
  const login = await post("/v1/auth/platform/login", { email: ADMIN_EMAIL, password });
  if (login.body.code !== "auth.totp_enrollment_required")
    throw new Error(`platform login: ${JSON.stringify(login.body)}`);
  const enrollmentToken = String(login.body.enrollmentToken);
  const enrol = await post("/v1/auth/platform/totp/enroll", { enrollmentToken });
  const activated = await post("/v1/auth/platform/totp/activate", {
    enrollmentToken,
    code: totpAt(String(enrol.body.secret), new Date()),
  });
  if (activated.status !== 200) throw new Error(`totp activate: ${JSON.stringify(activated.body)}`);
  const token = String(activated.body.accessToken);
  const created = await post(
    "/v1/admin/tenants",
    {
      type: "apartment",
      slug: "web-integration",
      displayName: "หอพักทดสอบเว็บ",
      legalName: "บริษัท ทดสอบเว็บ จำกัด",
      legalForm: "company",
      owner: { phone: OWNER_PHONE, language: "th" },
    },
    { authorization: `Bearer ${token}`, "idempotency-key": randomUUID() },
  );
  if (created.status !== 201) throw new Error(`onboard tenant: ${created.status} ${JSON.stringify(created.body)}`);
  const invitation = created.body.invitation as { code: string };
  const tenant = created.body.tenant as { id: string; displayName: string };
  log(`onboarded tenant ${tenant.displayName} (${tenant.id}); owner ${OWNER_PHONE}`);
  return { code: invitation.code, phone: OWNER_PHONE, tenantId: tenant.id, tenantName: tenant.displayName };
}

async function main() {
  mkdirSync(WORK, { recursive: true });
  const apiDir = prepareApi();
  const database = await startDatabase(apiDir);
  const stop = () => {
    database.child.kill("SIGINT");
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("exit", () => database.child.kill("SIGINT"));

  const { sms, totpAt } = await startApi(apiDir, database.url);
  const invitation = await onboardTenant(totpAt);

  createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/health") return send(200, { ok: true });
    if (url.pathname === "/invitation") return send(200, invitation);
    if (url.pathname === "/sms/last-code")
      return send(200, { code: sms.lastCodeTo(url.searchParams.get("phone") ?? "") ?? null });
    if (url.pathname === "/totp") return send(200, { code: totpAt(url.searchParams.get("secret") ?? "", new Date()) });
    return send(404, {});
  }).listen(CONTROL_PORT, "127.0.0.1", () => log(`control on http://127.0.0.1:${CONTROL_PORT}`));
}

main().catch((error: unknown) => {
  console.error("[integration] failed:", error);
  process.exit(1);
});
