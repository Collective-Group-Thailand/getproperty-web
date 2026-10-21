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
 *      first Owner is +66810000001, and a second tenant set up for the staff PWA (a building, two rooms
 *      with electricity meters, a Staff invitation); serves a side channel on INT_CONTROL_PORT (4211):
 *      `GET /health`, `GET /invitation` (the onboarding invitation), `GET /staff-invitation` (the staff
 *      world), `GET /sms/last-code?phone=` (the fake SMS outbox), `GET /totp?secret=` (an authenticator
 *      code), `PUT /storage?url=` (a presigned upload into the API's fake object storage).
 *   5. The F2 owner-console world (`GET /f2`): a third tenant whose owner (+66810000021) has a property, a
 *      building with one floor and a confirmed bank account on the fake KBank merchant; `GET /f2/units.xlsx`
 *      (the API's own import template with three rows), `POST /f2/resident-sign?code=&lease=&phone=` (the
 *      resident signs in with LINE, consents, accepts the invitation and signs the lease with the SMS OTP —
 *      what getproperty-liff does), `POST /f2/pay?invoice=<number>` (the fake provider's signed callback for
 *      the invoice's QR reference). The API's worker runs in this process (`WorkerRunner`, ticking every
 *      second) so QR codes, payment confirmations and receipts happen as they do in production.
 *   6. The F5 world (`GET /f5`): the platform admin's credentials and the authenticator secret the
 *      harness enrolled, and a second platform admin (`checker@getproperty.invalid`, temporary password,
 *      enrols at first sign-in) for the two-person tariff workflow; `POST /f5/sweep` runs the hourly
 *      `platform-subscriptions` job now (a trial that ended is invoiced).
 *   7. The R2 world (`GET /r2`, F2 2.7 / F4 4.4): a fourth tenant with the service and community modules on
 *      (feature flags per tenant), a building of two rooms with electricity meters, a Staff member who has
 *      already joined (+66810000042, signs in by OTP) and a resident (+66810000043) whose lease of R-101
 *      is active (signed in getproperty-liff's way, countersigned by the owner). `POST /r2/resident-request`
 *      reports a plumbing request as the resident (`POST /v1/resident/service-requests`), `GET
 *      /r2/resident-parcels` reads the resident's parcels with their pick-up PINs (`GET /v1/resident/parcels`).
 *   8. The release-fix world (`GET /rel`, triage F7, D-219–D-227): a fifth tenant with a confirmed bank account on
 *      the fake KBank merchant, an active lease of L-101 (signed getproperty-liff's way) whose rent invoice is
 *      issued with its QR, and a party (+66810000053) entered with a phone but never linked. `POST /rel/held`
 *      pays the invoice's QR through the provider's signed callback and then sends a second callback for the same
 *      QR — held as `qr_already_paid` (D-220); `POST /rel/phone-sign-in` signs in to the resident app with the
 *      SMS code of that phone (D-226: a pending link request, nothing linked); `GET /rel/resident-me` reads that
 *      login's `GET /v1/resident/me` (after a token refresh).
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
const STAFF_OWNER_PHONE = "+66810000009";
const STAFF_PHONE = "+66810000010";
const F2_OWNER_PHONE = "+66810000021";
const F2_MERCHANT = "010555000000777";
const R2_OWNER_PHONE = "+66810000041";
const R2_STAFF_PHONE = "+66810000042";
const R2_RESIDENT_PHONE = "+66810000043";
const REL_OWNER_PHONE = "+66810000051";
const REL_RESIDENT_PHONE = "+66810000052";
const REL_LINK_PHONE = "+66810000053";
const REL_MERCHANT = "010555000000778";
const PNG_BASE64 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8cf00000301010018dd8db00000000049454e44ae426082",
  "hex",
).toString("base64");
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
    OTP_MAX_PER_HOUR: "20",
    OTP_RESEND_SECONDS: "10",
    S3_BUCKET: "getproperty-webint",
    PUBLIC_WEB_APP_URL: "http://localhost:3200",
  });
  const require = createRequire(join(apiDir, "package.json"));
  const { NestFactory } = require("@nestjs/core") as NestCore;
  const { Module } = require("@nestjs/common") as {
    Module: (metadata: Record<string, unknown>) => (target: new () => unknown) => void;
  };
  const { AppModule } = require(join(apiDir, "dist/src/app.module.js")) as { AppModule: new () => unknown };
  // The worker's processors in this process (as the API's own integration suite does): with the in-memory
  // queue outside tests it ticks every second — QR codes, payment confirmations, receipts, documents.
  const { WorkerRunner } = require(join(apiDir, "dist/src/worker.runner.js")) as { WorkerRunner: unknown };
  class ApiWithWorker {}
  Module({ imports: [AppModule], providers: [WorkerRunner] })(ApiWithWorker);
  const { configureApp } = require(join(apiDir, "dist/src/bootstrap.js")) as { configureApp: (app: unknown) => void };
  const { SMS } = require(join(apiDir, "dist/src/integrations/sms/sms.port.js")) as { SMS: symbol | string };
  const { totpAt } = require(join(apiDir, "dist/src/core/identity/crypto/totp.js")) as {
    totpAt: (secret: string, at: Date) => string;
  };
  const app = await NestFactory.create(ApiWithWorker, { logger: ["error", "warn"], abortOnError: false });
  configureApp(app);
  await app.listen(API_PORT, "127.0.0.1");
  log(`getproperty-api listening on http://127.0.0.1:${API_PORT}`);
  const sms = app.get<{ lastCodeTo(phone: string): string | undefined }>(SMS);
  const { OBJECT_STORAGE } = require(join(apiDir, "dist/src/integrations/s3/object-storage.port.js")) as {
    OBJECT_STORAGE: symbol;
  };
  const storage = app.get<{ putDirect(key: string, body: Buffer, contentType: string): void }>(OBJECT_STORAGE);
  return { app, sms, totpAt, storage };
}

const API = `http://127.0.0.1:${API_PORT}`;

async function call(
  method: "POST" | "PUT" | "GET",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> & unknown[] }> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json().catch(() => ({}))) as Record<string, unknown> & unknown[],
  };
}

/** 4a. The platform admin's session (password + TOTP enrolment, D-164) and the authenticator secret it enrolled. */
async function platformToken(totpAt: (secret: string, at: Date) => string): Promise<{ token: string; secret: string }> {
  const password = "getproperty-dev-only-password";
  const login = await call("POST", "/v1/auth/platform/login", { email: ADMIN_EMAIL, password });
  if (login.body.code !== "auth.totp_enrollment_required")
    throw new Error(`platform login: ${JSON.stringify(login.body)}`);
  const enrollmentToken = String(login.body.enrollmentToken);
  const enrol = await call("POST", "/v1/auth/platform/totp/enroll", { enrollmentToken });
  const activated = await call("POST", "/v1/auth/platform/totp/activate", {
    enrollmentToken,
    code: totpAt(String(enrol.body.secret), new Date()),
  });
  if (activated.status !== 200) throw new Error(`totp activate: ${JSON.stringify(activated.body)}`);
  return { token: String(activated.body.accessToken), secret: String(enrol.body.secret) };
}

/**
 * 4e. The F5 world: a second platform admin (the checker of the two-person tariff workflow, D-021a) with
 * a temporary password — they enrol their authenticator at their first sign-in in the browser.
 */
const CHECKER_EMAIL = "checker@getproperty.invalid";
const CHECKER_PASSWORD = "checker-dev-only-password";
async function setupF5World(token: string) {
  const created = await call(
    "POST",
    "/v1/admin/platform-users",
    {
      displayName: "Checker Two",
      email: CHECKER_EMAIL,
      roles: ["platform_admin"],
      temporaryPassword: CHECKER_PASSWORD,
    },
    { authorization: `Bearer ${token}`, "idempotency-key": randomUUID() },
  );
  if (created.status !== 201) throw new Error(`checker: ${created.status} ${JSON.stringify(created.body)}`);
  log(`f5 world: second platform admin ${CHECKER_EMAIL}`);
}

/** 4b. A tenant whose first Owner (`phone`) is invited (D-145). */
async function createTenant(token: string, slug: string, displayName: string, phone: string) {
  const created = await call(
    "POST",
    "/v1/admin/tenants",
    {
      type: "apartment",
      slug,
      displayName,
      legalName: `บริษัท ${displayName} จำกัด`,
      legalForm: "company",
      owner: { phone, language: "th" },
    },
    { authorization: `Bearer ${token}`, "idempotency-key": randomUUID() },
  );
  if (created.status !== 201) throw new Error(`onboard tenant: ${created.status} ${JSON.stringify(created.body)}`);
  const invitation = created.body.invitation as { code: string };
  const tenant = created.body.tenant as { id: string; displayName: string };
  log(`onboarded tenant ${tenant.displayName} (${tenant.id}); owner ${phone}`);
  return { code: invitation.code, phone, tenantId: tenant.id, tenantName: tenant.displayName };
}

/**
 * 4c. The staff PWA's world (F4): a second tenant whose owner — signed in through the API with the
 * invitation — creates a property, a building with one floor of two rooms and their electricity
 * meters, and invites a Staff member for that building. The staff test signs in with that invitation.
 */
async function setupStaffWorld(token: string, sms: { lastCodeTo(phone: string): string | undefined }) {
  const owner = await createTenant(token, "web-integration-staff", "หอพักทดสอบพนักงาน", STAFF_OWNER_PHONE);
  const challenge = await call("POST", "/v1/auth/operator/otp/request", { phone: owner.phone });
  const pair = await call("POST", "/v1/auth/operator/otp/verify", {
    challengeId: challenge.body.challengeId,
    code: sms.lastCodeTo(owner.phone),
    invitationCode: owner.code,
  });
  if (pair.status !== 200) throw new Error(`owner sign-in: ${JSON.stringify(pair.body)}`);
  const auth = { authorization: `Bearer ${String(pair.body.accessToken)}` };
  const ok = (step: string, result: { status: number; body: unknown }) => {
    if (result.status >= 300) throw new Error(`${step}: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body as Record<string, unknown> & unknown[];
  };
  const property = ok(
    "property",
    await call("POST", "/v1/owner/properties", { code: "MAIN", name: "หอพักทดสอบ" }, auth),
  );
  const building = ok(
    "building",
    await call(
      "POST",
      "/v1/owner/buildings",
      { propertyId: property.id, code: "S", name: "อาคาร S", type: "apartment" },
      auth,
    ),
  );
  const floor = ok(
    "floor",
    await call("POST", `/v1/owner/buildings/${String(building.id)}/floors`, { level: 1, name: "ชั้น 1" }, auth),
  );
  ok(
    "units",
    await call(
      "POST",
      `/v1/owner/buildings/${String(building.id)}/units/bulk`,
      { floorIds: [floor.id], countPerFloor: 2, pattern: "{building}-{floor}{nn}" },
      auth,
    ),
  );
  const meters = ok(
    "meters",
    await call(
      "POST",
      `/v1/owner/buildings/${String(building.id)}/meters/actions/create-missing`,
      { utilities: ["electric"] },
      auth,
    ),
  );
  // The round counts readings from N days before the cut-off (D-187, default 7): widen the window so a
  // reading taken today counts whatever the day the suite runs.
  ok(
    "round window",
    await call(
      "PUT",
      "/v1/owner/settings/readings.round_window_days",
      { value: 31, reason: "web integration suite" },
      auth,
    ),
  );
  const invitation = ok(
    "staff invitation",
    await call(
      "POST",
      "/v1/owner/invitations",
      { role: "staff", channel: "sms", phone: STAFF_PHONE, language: "en", buildingIds: [building.id] },
      auth,
    ),
  );
  log(`staff world: building ${String(building.name)}, ${meters.length} meters, staff ${STAFF_PHONE} invited`);
  return {
    code: String(invitation.code),
    phone: STAFF_PHONE,
    tenantName: owner.tenantName,
    buildingName: String(building.name),
    meters: meters.length,
  };
}

/** An operator session kept fresh (access tokens are short-lived; the F2 controls run minutes later). */
class OperatorSession {
  constructor(
    private access: string,
    private refresh: string,
    private at = Date.now(),
  ) {}
  async header(): Promise<Record<string, string>> {
    if (Date.now() - this.at > 4 * 60_000) {
      const renewed = await call("POST", "/v1/auth/refresh", { refreshToken: this.refresh });
      if (renewed.status !== 200) throw new Error(`refresh: ${JSON.stringify(renewed.body)}`);
      this.access = String(renewed.body.accessToken);
      this.refresh = String(renewed.body.refreshToken);
      this.at = Date.now();
    }
    return { authorization: `Bearer ${this.access}` };
  }
}

/** An SMS OTP challenge, waiting out the resend gap when the phone just received one. */
async function otpChallenge(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const challenge = await call("POST", path, body, headers);
    if (challenge.status < 300) return challenge.body;
    if (challenge.status !== 429) throw new Error(`${path}: ${challenge.status} ${JSON.stringify(challenge.body)}`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error(`${path}: still rate limited`);
}

/**
 * 4d. The F2 owner-console world: a tenant whose owner signs in through the API with the invitation, a
 * property and a building with floor 1 (the units come from the Excel import in the browser), and a bank
 * account on the fake KBank merchant confirmed with the SMS OTP — so issued invoices get their QR.
 */
async function setupF2World(token: string, sms: { lastCodeTo(phone: string): string | undefined }) {
  const owner = await createTenant(token, "web-integration-f2", "หอพักทดสอบคอนโซล", F2_OWNER_PHONE);
  const challenge = await otpChallenge("/v1/auth/operator/otp/request", { phone: owner.phone });
  const pair = await call("POST", "/v1/auth/operator/otp/verify", {
    challengeId: challenge.challengeId,
    code: sms.lastCodeTo(owner.phone),
    invitationCode: owner.code,
  });
  if (pair.status !== 200) throw new Error(`f2 owner sign-in: ${JSON.stringify(pair.body)}`);
  const session = new OperatorSession(String(pair.body.accessToken), String(pair.body.refreshToken));
  const ok = (step: string, result: { status: number; body: unknown }) => {
    if (result.status >= 300) throw new Error(`${step}: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body as Record<string, unknown> & unknown[];
  };
  const property = ok(
    "f2 property",
    await call("POST", "/v1/owner/properties", { code: "F2", name: "หอพักคอนโซล" }, await session.header()),
  );
  const building = ok(
    "f2 building",
    await call(
      "POST",
      "/v1/owner/buildings",
      { propertyId: property.id, code: "F", name: "อาคาร F", type: "apartment" },
      await session.header(),
    ),
  );
  ok(
    "f2 floor",
    await call(
      "POST",
      `/v1/owner/buildings/${String(building.id)}/floors`,
      { level: 1, name: "ชั้น 1" },
      await session.header(),
    ),
  );
  const account = ok(
    "f2 bank account",
    await call(
      "POST",
      "/v1/owner/bank-accounts",
      {
        bankCode: "004",
        bankNameTh: "ธนาคารกสิกรไทย",
        accountNo: "123-4-56789-0",
        accountName: "บริษัท หอพักทดสอบคอนโซล จำกัด",
        isDefault: true,
        paymentProvider: "kbank",
        providerMerchantRef: F2_MERCHANT,
      },
      { ...(await session.header()), "idempotency-key": randomUUID() },
    ),
  ) as unknown as { account: { id: string }; otp: { challengeId: string } };
  ok(
    "f2 bank account confirm",
    await call(
      "POST",
      `/v1/owner/bank-accounts/${account.account.id}/actions/confirm`,
      { challengeId: account.otp.challengeId, code: sms.lastCodeTo(owner.phone) },
      await session.header(),
    ),
  );
  log(`f2 world: ${owner.tenantName}, building ${String(building.name)}, merchant ${F2_MERCHANT}`);
  return {
    session,
    world: {
      phone: owner.phone,
      tenantName: owner.tenantName,
      buildingId: String(building.id),
      buildingName: String(building.name),
      propertyId: String(property.id),
    },
  };
}

/** The API's own unit-import template with three units on floors 1 and 2 (floor 2 is created by the import). */
async function f2UnitsWorkbook(apiDir: string, session: OperatorSession, buildingId: string): Promise<Buffer> {
  const response = await fetch(`${API}/v1/owner/buildings/${buildingId}/unit-imports/template`, {
    headers: await session.header(),
  });
  if (!response.ok) throw new Error(`template: ${response.status}`);
  const require = createRequire(join(apiDir, "package.json"));
  const ExcelJS = require("exceljs") as {
    Workbook: new () => {
      xlsx: { load(data: ArrayBuffer): Promise<unknown>; writeBuffer(): Promise<ArrayBuffer> };
      getWorksheet(name: string): { addRow(values: unknown[]): unknown } | undefined;
    };
  };
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  const sheet = workbook.getWorksheet("units");
  if (!sheet) throw new Error("template has no units sheet");
  sheet.addRow(["F-101", 1, "room", "25", "4500", "", ""]);
  sheet.addRow(["F-102", 1, "room", "25", "4500", "", ""]);
  sheet.addRow(["F-201", 2, "room", "28", "5200", "", ""]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** What getproperty-liff does for the lessee: LINE login → consents → accept the invitation → sign with OTP. */
async function f2ResidentSigns(
  apiDir: string,
  sms: { lastCodeTo(phone: string): string | undefined },
  input: { code: string; leaseId: string; phone: string },
) {
  const require = createRequire(join(apiDir, "package.json"));
  const { fakeLineIdToken } = require(join(apiDir, "dist/src/integrations/line/fake-line-login.js")) as {
    fakeLineIdToken: (claims: { sub: string; name?: string }) => string;
  };
  const step = (name: string, result: { status: number; body: unknown }) => {
    if (result.status >= 300) throw new Error(`${name}: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body as Record<string, unknown> & unknown[];
  };
  const login = step(
    "resident line",
    await call("POST", "/v1/auth/resident/line", {
      idToken: fakeLineIdToken({ sub: `U${randomUUID().replace(/-/g, "")}`, name: "ผู้เช่าทดสอบ" }),
    }),
  );
  const first = { authorization: `Bearer ${String(login.accessToken)}` };
  const purposes = step("consents", await call("GET", "/v1/resident/consents", undefined, first)) as unknown as {
    key: string;
    version: number;
    required: boolean;
  }[];
  step(
    "consent",
    await call(
      "POST",
      "/v1/resident/consents",
      {
        items: purposes
          .filter((purpose) => purpose.required)
          .map((purpose) => ({ purposeKey: purpose.key, version: purpose.version, granted: true })),
      },
      first,
    ),
  );
  step("accept", await call("POST", `/v1/resident/invitations/${encodeURIComponent(input.code)}/accept`, {}, first));
  const refreshed = step("refresh", await call("POST", "/v1/auth/refresh", { refreshToken: login.refreshToken }));
  const auth = { authorization: `Bearer ${String(refreshed.accessToken)}` };
  const contract = step(
    "contract",
    await call("GET", `/v1/resident/leases/${input.leaseId}/contract`, undefined, auth),
  );
  const otp = await otpChallenge(`/v1/resident/leases/${input.leaseId}/signature/otp`, {}, auth);
  return step(
    "sign",
    await call(
      "POST",
      `/v1/resident/leases/${input.leaseId}/sign`,
      {
        challengeId: otp.challengeId,
        code: sms.lastCodeTo(input.phone),
        contractSha256: contract.sha256,
        signaturePng: PNG_BASE64,
      },
      { ...auth, "idempotency-key": randomUUID() },
    ),
  );
}

/**
 * 7. The R2 world (F2 2.7, F4 4.4): a tenant with the service and community modules on, a building of two
 * rooms with meters, a Staff member who already joined, and a resident with an active lease of R-101 —
 * signed the way getproperty-liff does it (LINE login, consent, invitation, OTP), countersigned by the owner.
 * Returns what the controls need: the resident's refresh token (their scopes include the unit once the
 * lease is active) and the ids.
 */
async function setupR2World(apiDir: string, token: string, sms: { lastCodeTo(phone: string): string | undefined }) {
  const owner = await createTenant(token, "web-integration-r2", "หอพักทดสอบงานซ่อม", R2_OWNER_PHONE);
  const admin = { authorization: `Bearer ${token}` };
  for (const key of ["module.service_requests", "module.community"]) {
    const flag = await call(
      "PUT",
      `/v1/admin/feature-flags/${key}`,
      { tenantId: owner.tenantId, enabled: true, reason: "web integration suite (R2)" },
      admin,
    );
    if (flag.status >= 300) throw new Error(`flag ${key}: ${flag.status} ${JSON.stringify(flag.body)}`);
  }
  const challenge = await otpChallenge("/v1/auth/operator/otp/request", { phone: owner.phone });
  const pair = await call("POST", "/v1/auth/operator/otp/verify", {
    challengeId: challenge.challengeId,
    code: sms.lastCodeTo(owner.phone),
    invitationCode: owner.code,
  });
  if (pair.status !== 200) throw new Error(`r2 owner sign-in: ${JSON.stringify(pair.body)}`);
  const session = new OperatorSession(String(pair.body.accessToken), String(pair.body.refreshToken));
  const ok = (step: string, result: { status: number; body: unknown }) => {
    if (result.status >= 300) throw new Error(`r2 ${step}: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body as Record<string, unknown> & unknown[];
  };
  const auth = async (extra: Record<string, string> = {}) => ({ ...(await session.header()), ...extra });
  const property = ok(
    "property",
    await call("POST", "/v1/owner/properties", { code: "R2", name: "หอพักงานซ่อม" }, await auth()),
  );
  const building = ok(
    "building",
    await call(
      "POST",
      "/v1/owner/buildings",
      { propertyId: property.id, code: "R", name: "อาคาร R", type: "apartment" },
      await auth(),
    ),
  );
  const buildingId = String(building.id);
  const floor = ok(
    "floor",
    await call("POST", `/v1/owner/buildings/${buildingId}/floors`, { level: 1, name: "ชั้น 1" }, await auth()),
  );
  ok(
    "units",
    await call(
      "POST",
      `/v1/owner/buildings/${buildingId}/units/bulk`,
      { floorIds: [floor.id], countPerFloor: 2, pattern: "{building}-{floor}{nn}" },
      await auth(),
    ),
  );
  ok(
    "meters",
    await call(
      "POST",
      `/v1/owner/buildings/${buildingId}/meters/actions/create-missing`,
      { utilities: ["electric"] },
      await auth(),
    ),
  );
  const units = ok(
    "unit list",
    await call("GET", `/v1/owner/units?buildingId=${buildingId}&perPage=10`, undefined, await auth()),
  ).data as unknown as { id: string; unitNo: string }[];
  const unit = units.find((candidate) => candidate.unitNo.endsWith("101")) ?? units[0]!;

  // The Staff member joins with the invitation (the browser then signs in as a member).
  const invitation = ok(
    "staff invitation",
    await call(
      "POST",
      "/v1/owner/invitations",
      { role: "staff", channel: "sms", phone: R2_STAFF_PHONE, language: "en", buildingIds: [buildingId] },
      await auth(),
    ),
  );
  const staffChallenge = await otpChallenge("/v1/auth/operator/otp/request", { phone: R2_STAFF_PHONE });
  ok(
    "staff joins",
    await call("POST", "/v1/auth/operator/otp/verify", {
      challengeId: staffChallenge.challengeId,
      code: sms.lastCodeTo(R2_STAFF_PHONE),
      invitationCode: invitation.code,
    }),
  );

  // The resident's lease of R-101: created, sent, signed in the resident's app, countersigned.
  const party = ok(
    "resident",
    await call(
      "POST",
      "/v1/owner/parties",
      {
        type: "person",
        displayName: "วิภา ทดสอบงานซ่อม",
        firstName: "วิภา",
        lastName: "ทดสอบงานซ่อม",
        phone: R2_RESIDENT_PHONE,
        idDocumentType: "thai_national_id",
        idNumber: "1101700207048",
      },
      await auth(),
    ),
  );
  // Started yesterday: the API puts `unit:<id>` in the resident's token when the occupancy's `validFrom` is on or
  // before its UTC date — a Bangkok "today" is still tomorrow in UTC between 00:00 and 07:00.
  const today = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lease = ok(
    "lease",
    await call(
      "POST",
      "/v1/owner/leases",
      {
        unitId: unit.id,
        lesseePartyId: party.id,
        startDate: today,
        months: 12,
        rent: "4500.00",
        utilityBillingMode: "included",
      },
      await auth(),
    ),
  );
  const leaseId = String(lease.id);
  ok(
    "send",
    await call(
      "POST",
      `/v1/owner/leases/${leaseId}/actions/send-for-signature`,
      {},
      await auth({ "idempotency-key": randomUUID() }),
    ),
  );
  const leaseInvitation = ok(
    "lease invitation",
    await call("POST", `/v1/owner/leases/${leaseId}/invitations`, { channel: "link", partyId: party.id }, await auth()),
  );
  const resident = await residentSignsLease(apiDir, sms, {
    code: String(leaseInvitation.code),
    leaseId,
    phone: R2_RESIDENT_PHONE,
  });
  ok(
    "countersign",
    await call(
      "POST",
      `/v1/owner/leases/${leaseId}/actions/countersign`,
      { signaturePng: PNG_BASE64 },
      await auth({ "idempotency-key": randomUUID() }),
    ),
  );
  log(`r2 world: ${owner.tenantName}, building ${String(building.name)}, lease of ${unit.unitNo} active`);
  return {
    resident,
    world: {
      ownerPhone: R2_OWNER_PHONE,
      staffPhone: R2_STAFF_PHONE,
      tenantName: owner.tenantName,
      buildingId,
      buildingName: String(building.name),
      unitId: unit.id,
      unitNo: unit.unitNo,
      residentName: "วิภา ทดสอบงานซ่อม",
    },
  };
}

/** A resident's session (refresh token rotated on every use), as getproperty-liff keeps it. */
class ResidentSession {
  constructor(private refresh: string) {}
  async header(): Promise<Record<string, string>> {
    const renewed = await call("POST", "/v1/auth/refresh", { refreshToken: this.refresh });
    if (renewed.status !== 200) throw new Error(`resident refresh: ${JSON.stringify(renewed.body)}`);
    this.refresh = String(renewed.body.refreshToken);
    return { authorization: `Bearer ${String(renewed.body.accessToken)}` };
  }
}

/** getproperty-liff's lease signature (LINE login → consents → invitation → OTP → sign); the session is kept. */
async function residentSignsLease(
  apiDir: string,
  sms: { lastCodeTo(phone: string): string | undefined },
  input: { code: string; leaseId: string; phone: string },
): Promise<ResidentSession> {
  const require = createRequire(join(apiDir, "package.json"));
  const { fakeLineIdToken } = require(join(apiDir, "dist/src/integrations/line/fake-line-login.js")) as {
    fakeLineIdToken: (claims: { sub: string; name?: string }) => string;
  };
  const step = (name: string, result: { status: number; body: unknown }) => {
    if (result.status >= 300) throw new Error(`r2 ${name}: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body as Record<string, unknown> & unknown[];
  };
  const login = step(
    "resident line",
    await call("POST", "/v1/auth/resident/line", {
      idToken: fakeLineIdToken({ sub: `U${randomUUID().replace(/-/g, "")}`, name: "วิภา" }),
    }),
  );
  const first = { authorization: `Bearer ${String(login.accessToken)}` };
  const purposes = step("consents", await call("GET", "/v1/resident/consents", undefined, first)) as unknown as {
    key: string;
    version: number;
    required: boolean;
  }[];
  step(
    "consent",
    await call(
      "POST",
      "/v1/resident/consents",
      {
        items: purposes
          .filter((purpose) => purpose.required)
          .map((purpose) => ({ purposeKey: purpose.key, version: purpose.version, granted: true })),
      },
      first,
    ),
  );
  step("accept", await call("POST", `/v1/resident/invitations/${encodeURIComponent(input.code)}/accept`, {}, first));
  const session = new ResidentSession(String(login.refreshToken));
  const auth = await session.header();
  const contract = step(
    "contract",
    await call("GET", `/v1/resident/leases/${input.leaseId}/contract`, undefined, auth),
  );
  const otp = await otpChallenge(`/v1/resident/leases/${input.leaseId}/signature/otp`, {}, auth);
  step(
    "sign",
    await call(
      "POST",
      `/v1/resident/leases/${input.leaseId}/sign`,
      {
        challengeId: otp.challengeId,
        code: sms.lastCodeTo(input.phone),
        contractSha256: contract.sha256,
        signaturePng: PNG_BASE64,
      },
      { ...auth, "idempotency-key": randomUUID() },
    ),
  );
  return session;
}

/** The resident reports a plumbing problem in R-101 from getproperty-liff (`POST /v1/resident/service-requests`). */
async function r2ResidentRequest(resident: ResidentSession, unitId: string) {
  const auth = await resident.header();
  const categories = await call("GET", `/v1/resident/service-categories?unitId=${unitId}`, undefined, auth);
  const list = (categories.body.data ?? []) as unknown as { id: string; key: string }[];
  const plumbing = list.find((category) => category.key === "plumbing") ?? list[0];
  if (!plumbing) throw new Error(`r2 categories: ${categories.status} ${JSON.stringify(categories.body)}`);
  const created = await call(
    "POST",
    "/v1/resident/service-requests",
    { unitId, categoryId: plumbing.id, description: "ก๊อกน้ำในห้องน้ำรั่ว น้ำหยดทั้งคืน", priority: "normal" },
    { ...auth, "idempotency-key": randomUUID() },
  );
  if (created.status !== 201) throw new Error(`r2 request: ${created.status} ${JSON.stringify(created.body)}`);
  return created.body;
}

/** The fake KBank's signed callback for an issued invoice's QR reference (D-042). */
async function f2ProviderPays(app: NestApp, apiDir: string, session: OperatorSession, number: string) {
  const list = await call(
    "GET",
    `/v1/owner/invoices?q=${encodeURIComponent(number)}`,
    undefined,
    await session.header(),
  );
  const summary = (list.body.data as unknown as { id: string; number: string | null }[] | undefined)?.find(
    (candidate) => candidate.number === number,
  );
  if (!summary) throw new Error(`invoice ${number} not found`);
  const detail = await call("GET", `/v1/owner/invoices/${summary.id}`, undefined, await session.header());
  const reference = String(detail.body.promptpayRef ?? number.replace(/-/g, ""));
  const amount = String(detail.body.amountDue ?? detail.body.balance);
  const require = createRequire(join(apiDir, "package.json"));
  const { PAYMENT_PROVIDERS } = require(join(apiDir, "dist/src/integrations/payments/payment-provider.port.js")) as {
    PAYMENT_PROVIDERS: symbol;
  };
  const fake = app
    .get<{
      adapter(provider: string): {
        simulatePayment(p: Record<string, unknown>): { body: string; headers: Record<string, string> };
      };
    }>(PAYMENT_PROVIDERS)
    .adapter("kbank");
  const callback = fake.simulatePayment({
    merchantRef: F2_MERCHANT,
    reference,
    amount,
    providerRef: `KB-${Date.now()}`,
    paidAt: new Date(),
  });
  const response = await fetch(`${API}/webhooks/payments/kbank`, {
    method: "POST",
    headers: callback.headers,
    body: callback.body,
  });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
    invoiceId: summary.id,
    amount,
    reference,
  };
}

/** One signed callback of the fake KBank (`simulatePayment`) for a QR reference, as the provider sends it. */
async function kbankCallback(
  app: NestApp,
  apiDir: string,
  input: { merchantRef: string; reference: string; amount: string; providerRef: string },
) {
  const require = createRequire(join(apiDir, "package.json"));
  const { PAYMENT_PROVIDERS } = require(join(apiDir, "dist/src/integrations/payments/payment-provider.port.js")) as {
    PAYMENT_PROVIDERS: symbol;
  };
  const fake = app
    .get<{
      adapter(provider: string): {
        simulatePayment(p: Record<string, unknown>): { body: string; headers: Record<string, string> };
      };
    }>(PAYMENT_PROVIDERS)
    .adapter("kbank");
  const callback = fake.simulatePayment({ ...input, paidAt: new Date() });
  const response = await fetch(`${API}/webhooks/payments/kbank`, {
    method: "POST",
    headers: callback.headers,
    body: callback.body,
  });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Polls `read` until `done` holds (the API's worker ticks every second), or fails after `ms`. */
async function until<T>(what: string, read: () => Promise<T>, done: (value: T) => boolean, ms = 60_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error(`${what}: not reached in ${ms} ms (${JSON.stringify(value)})`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/**
 * 8. The release-fix world (triage F7): a tenant with a confirmed KBank account, an active lease of L-101 signed
 * the way getproperty-liff does, its rent invoice issued with a QR (billing cycle open → compute → issue), and a
 * party entered with a phone number nobody has linked yet.
 */
async function setupReleaseWorld(
  apiDir: string,
  token: string,
  sms: { lastCodeTo(phone: string): string | undefined },
) {
  const owner = await createTenant(token, "web-integration-rel", "หอพักทดสอบรีลีส", REL_OWNER_PHONE);
  const challenge = await otpChallenge("/v1/auth/operator/otp/request", { phone: owner.phone });
  const pair = await call("POST", "/v1/auth/operator/otp/verify", {
    challengeId: challenge.challengeId,
    code: sms.lastCodeTo(owner.phone),
    invitationCode: owner.code,
  });
  if (pair.status !== 200) throw new Error(`rel owner sign-in: ${JSON.stringify(pair.body)}`);
  const session = new OperatorSession(String(pair.body.accessToken), String(pair.body.refreshToken));
  const ok = (step: string, result: { status: number; body: unknown }) => {
    if (result.status >= 300) throw new Error(`rel ${step}: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body as Record<string, unknown> & unknown[];
  };
  const auth = async (extra: Record<string, string> = {}) => ({ ...(await session.header()), ...extra });
  const property = ok(
    "property",
    await call("POST", "/v1/owner/properties", { code: "RL", name: "หอพักรีลีส" }, await auth()),
  );
  const building = ok(
    "building",
    await call(
      "POST",
      "/v1/owner/buildings",
      { propertyId: property.id, code: "L", name: "อาคาร L", type: "apartment" },
      await auth(),
    ),
  );
  const buildingId = String(building.id);
  const floor = ok(
    "floor",
    await call("POST", `/v1/owner/buildings/${buildingId}/floors`, { level: 1, name: "ชั้น 1" }, await auth()),
  );
  ok(
    "units",
    await call(
      "POST",
      `/v1/owner/buildings/${buildingId}/units/bulk`,
      { floorIds: [floor.id], countPerFloor: 2, pattern: "{building}-{floor}{nn}" },
      await auth(),
    ),
  );
  const units = ok(
    "unit list",
    await call("GET", `/v1/owner/units?buildingId=${buildingId}&perPage=10`, undefined, await auth()),
  ).data as unknown as { id: string; unitNo: string }[];
  const unit = units.find((candidate) => candidate.unitNo.endsWith("101")) ?? units[0]!;
  const account = ok(
    "bank account",
    await call(
      "POST",
      "/v1/owner/bank-accounts",
      {
        bankCode: "004",
        bankNameTh: "ธนาคารกสิกรไทย",
        accountNo: "123-4-56789-1",
        accountName: "บริษัท หอพักทดสอบรีลีส จำกัด",
        isDefault: true,
        paymentProvider: "kbank",
        providerMerchantRef: REL_MERCHANT,
      },
      await auth({ "idempotency-key": randomUUID() }),
    ),
  ) as unknown as { account: { id: string }; otp: { challengeId: string } };
  ok(
    "bank account confirm",
    await call(
      "POST",
      `/v1/owner/bank-accounts/${account.account.id}/actions/confirm`,
      { challengeId: account.otp.challengeId, code: sms.lastCodeTo(owner.phone) },
      await auth(),
    ),
  );

  // The resident's lease of L-101 (signed in the resident's app, countersigned): active from yesterday (UTC).
  const resident = ok(
    "resident",
    await call(
      "POST",
      "/v1/owner/parties",
      {
        type: "person",
        displayName: "ธีรวัฒน์ ทดสอบรีลีส",
        firstName: "ธีรวัฒน์",
        lastName: "ทดสอบรีลีส",
        phone: REL_RESIDENT_PHONE,
        idDocumentType: "thai_national_id",
        idNumber: "1101700207056",
      },
      await auth(),
    ),
  );
  const startDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lease = ok(
    "lease",
    await call(
      "POST",
      "/v1/owner/leases",
      {
        unitId: unit.id,
        lesseePartyId: resident.id,
        startDate,
        months: 12,
        rent: "4500.00",
        utilityBillingMode: "included",
      },
      await auth(),
    ),
  );
  const leaseId = String(lease.id);
  ok(
    "send",
    await call(
      "POST",
      `/v1/owner/leases/${leaseId}/actions/send-for-signature`,
      {},
      await auth({ "idempotency-key": randomUUID() }),
    ),
  );
  const invitation = ok(
    "lease invitation",
    await call(
      "POST",
      `/v1/owner/leases/${leaseId}/invitations`,
      { channel: "link", partyId: resident.id },
      await auth(),
    ),
  );
  await residentSignsLease(apiDir, sms, { code: String(invitation.code), leaseId, phone: REL_RESIDENT_PHONE });
  ok(
    "countersign",
    await call(
      "POST",
      `/v1/owner/leases/${leaseId}/actions/countersign`,
      { signaturePng: PNG_BASE64 },
      await auth({ "idempotency-key": randomUUID() }),
    ),
  );
  await until(
    "lease active",
    async () => (await call("GET", `/v1/owner/leases/${leaseId}`, undefined, await auth())).body.status,
    (status) => status === "active",
  );

  // The month's rent invoice with its QR: open the cycle (or get the one the worker opened), compute, issue.
  const cycle = ok("cycle", await call("POST", "/v1/owner/billing-cycles", { propertyId: property.id }, await auth()));
  ok("compute", await call("POST", `/v1/owner/billing-cycles/${String(cycle.id)}/actions/compute`, {}, await auth()));
  ok(
    "issue",
    await call(
      "POST",
      `/v1/owner/billing-cycles/${String(cycle.id)}/actions/issue`,
      {},
      await auth({ "idempotency-key": randomUUID() }),
    ),
  );
  const invoice = await until(
    "invoice with QR",
    async () => {
      const list = await call("GET", `/v1/owner/invoices?unitId=${unit.id}`, undefined, await auth());
      const issued = (list.body.data as unknown as { id: string; number: string | null }[] | undefined)?.find(
        (candidate) => candidate.number,
      );
      if (!issued) return null;
      return (await call("GET", `/v1/owner/invoices/${issued.id}`, undefined, await auth())).body as Record<
        string,
        unknown
      >;
    },
    (detail) => Boolean(detail?.promptpayRef),
  );

  // A party entered with a phone number that no login is linked to yet (D-226).
  const linkParty = ok(
    "link party",
    await call(
      "POST",
      "/v1/owner/parties",
      {
        type: "person",
        displayName: "อรุณี รอยืนยัน",
        firstName: "อรุณี",
        lastName: "รอยืนยัน",
        phone: REL_LINK_PHONE,
        idDocumentType: "thai_national_id",
        idNumber: "1101700207064",
      },
      await auth(),
    ),
  );
  log(`release world: ${owner.tenantName}, lease of ${unit.unitNo} active, invoice ${String(invoice!.number)} issued`);
  return {
    session,
    world: {
      ownerPhone: REL_OWNER_PHONE,
      tenantName: owner.tenantName,
      buildingId,
      unitId: unit.id,
      unitNo: unit.unitNo,
      leaseId,
      leaseEndDate: String(lease.endDate ?? ""),
      invoiceId: String(invoice!.id),
      invoiceNumber: String(invoice!.number),
      invoiceTotal: String(invoice!.total),
      promptpayRef: String(invoice!.promptpayRef),
      linkPartyId: String(linkParty.id),
      linkPartyName: "อรุณี รอยืนยัน",
      linkPhone: REL_LINK_PHONE,
    },
  };
}

/** D-220: the invoice's QR is paid by the provider, then the same QR again (a second transfer) — that one is held. */
async function releaseHeldPayment(
  app: NestApp,
  apiDir: string,
  session: OperatorSession,
  world: { invoiceId: string; invoiceTotal: string; promptpayRef: string },
) {
  const first = await kbankCallback(app, apiDir, {
    merchantRef: REL_MERCHANT,
    reference: world.promptpayRef,
    amount: world.invoiceTotal,
    providerRef: `KB-REL-${Date.now()}-1`,
  });
  if (first.status >= 300) throw new Error(`first callback: ${first.status} ${JSON.stringify(first.body)}`);
  await until(
    "invoice paid",
    async () =>
      (await call("GET", `/v1/owner/invoices/${world.invoiceId}`, undefined, await session.header())).body.status,
    (status) => status === "paid",
  );
  const second = await kbankCallback(app, apiDir, {
    merchantRef: REL_MERCHANT,
    reference: world.promptpayRef,
    amount: world.invoiceTotal,
    providerRef: `KB-REL-${Date.now()}-2`,
  });
  if (second.status >= 300) throw new Error(`second callback: ${second.status} ${JSON.stringify(second.body)}`);
  const held = await until(
    "held payment",
    async () => {
      const list = await call("GET", "/v1/owner/payments?status=pending", undefined, await session.header());
      return (list.body.data as unknown as { id: string; heldReason: string | null }[] | undefined)?.find(
        (payment) => payment.heldReason,
      );
    },
    (payment) => Boolean(payment),
  );
  return { first: first.body, second: second.body, held };
}

/** D-226: someone signs in to the resident app with the SMS code of the party's phone; nothing is linked yet. */
async function releasePhoneSignIn(sms: { lastCodeTo(phone: string): string | undefined }, phone: string) {
  const challenge = await otpChallenge("/v1/auth/resident/otp/request", { phone });
  const pair = await call("POST", "/v1/auth/resident/otp/verify", {
    challengeId: challenge.challengeId,
    code: sms.lastCodeTo(phone),
  });
  if (pair.status !== 200) throw new Error(`resident OTP sign-in: ${pair.status} ${JSON.stringify(pair.body)}`);
  const resident = new ResidentSession(String(pair.body.refreshToken));
  const me = await call("GET", "/v1/resident/me", undefined, await resident.header());
  return { resident, me: me.body };
}

/**
 * 3b. The worker's `document-scan` subscriber, in this process: the harness runs the API only (no
 * worker, no outbox relay), and the uploaded bytes live in the API process's fake object storage, so
 * every completed upload is scanned here (checksum, fake virus scan, thumbnail) by the API's own
 * `DocumentsService.scan` — what the worker does a moment after `document.uploaded` in production.
 */
function startDocumentScans(app: NestApp, apiDir: string) {
  const require = createRequire(join(apiDir, "package.json"));
  const { DocumentsService } = require(join(apiDir, "dist/src/core/documents/documents.service.js")) as {
    DocumentsService: unknown;
  };
  const { TenantTx } = require(join(apiDir, "dist/src/database/tenant-tx.js")) as { TenantTx: unknown };
  type Tx = { document: { findMany(args: unknown): Promise<{ id: string }[]> } };
  const documents = app.get<{ scan(tx: Tx, id: string): Promise<unknown> }>(DocumentsService);
  const db = app.get<{ platform<T>(work: (tx: Tx) => Promise<T>): Promise<T> }>(TenantTx);
  let busy = false;
  setInterval(() => {
    if (busy) return;
    busy = true;
    void db
      .platform(async (tx) => {
        const pending = await tx.document.findMany({
          where: { scanStatus: "pending", uploadState: { in: ["uploaded", "verified"] }, deletedAt: null },
          select: { id: true },
          take: 20,
        });
        for (const doc of pending) await documents.scan(tx, doc.id);
      })
      .catch((error: unknown) => log("document scan failed:", (error as Error).message))
      .finally(() => {
        busy = false;
      });
  }, 500).unref();
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

  const { app, sms, totpAt, storage } = await startApi(apiDir, database.url);
  const platform = await platformToken(totpAt);
  const token = platform.token;
  const invitation = await createTenant(token, "web-integration", "หอพักทดสอบเว็บ", OWNER_PHONE);
  const staffWorld = await setupStaffWorld(token, sms);
  const f2 = await setupF2World(token, sms);
  await setupF5World(token);
  const r2 = await setupR2World(apiDir, token, sms);
  const rel = await setupReleaseWorld(apiDir, token, sms);
  let relLogin: ResidentSession | null = null;
  startDocumentScans(app, apiDir);
  const require = createRequire(join(apiDir, "package.json"));
  const { SubscriptionsService } = require(
    join(apiDir, "dist/src/modules/platform-subscriptions/subscriptions.service.js"),
  ) as {
    SubscriptionsService: unknown;
  };
  const subscriptions = app.get<{ sweep(): Promise<{ invoices: number; transitions: number }> }>(SubscriptionsService);

  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/health") return send(200, { ok: true });
    if (url.pathname === "/invitation") return send(200, invitation);
    if (url.pathname === "/staff-invitation") return send(200, staffWorld);
    try {
      if (url.pathname === "/f2") return send(200, f2.world);
      if (url.pathname === "/f2/units.xlsx") {
        const workbook = await f2UnitsWorkbook(apiDir, f2.session, f2.world.buildingId);
        res.writeHead(200, { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        return res.end(workbook);
      }
      if (url.pathname === "/f2/resident-sign" && req.method === "POST") {
        const signed = await f2ResidentSigns(apiDir, sms, {
          code: url.searchParams.get("code") ?? "",
          leaseId: url.searchParams.get("lease") ?? "",
          phone: url.searchParams.get("phone") ?? "",
        });
        return send(200, signed);
      }
      if (url.pathname === "/f5")
        return send(200, {
          adminEmail: ADMIN_EMAIL,
          adminPassword: "getproperty-dev-only-password",
          adminSecret: platform.secret,
          checkerEmail: CHECKER_EMAIL,
          checkerPassword: CHECKER_PASSWORD,
          tenantName: f2.world.tenantName,
          ownerPhone: f2.world.phone,
        });
      if (url.pathname === "/r2") return send(200, r2.world);
      if (url.pathname === "/rel") return send(200, rel.world);
      if (url.pathname === "/rel/held" && req.method === "POST")
        return send(200, await releaseHeldPayment(app, apiDir, rel.session, rel.world));
      if (url.pathname === "/rel/phone-sign-in" && req.method === "POST") {
        const signedIn = await releasePhoneSignIn(sms, rel.world.linkPhone);
        relLogin = signedIn.resident;
        return send(200, signedIn.me);
      }
      if (url.pathname === "/rel/resident-me") {
        if (!relLogin) return send(409, { error: "sign in first (POST /rel/phone-sign-in)" });
        const me = await call("GET", "/v1/resident/me", undefined, await relLogin.header());
        return send(me.status, me.body);
      }
      if (url.pathname === "/r2/resident-request" && req.method === "POST")
        return send(200, await r2ResidentRequest(r2.resident, r2.world.unitId));
      if (url.pathname === "/r2/resident-parcels") {
        const parcels = await call("GET", "/v1/resident/parcels", undefined, await r2.resident.header());
        return send(parcels.status, parcels.body);
      }
      // The hourly `platform-subscriptions` job (worker), run now: trials that ended get their first invoice.
      if (url.pathname === "/f5/sweep" && req.method === "POST") return send(200, await subscriptions.sweep());
      if (url.pathname === "/f2/pay" && req.method === "POST")
        return send(200, await f2ProviderPays(app, apiDir, f2.session, url.searchParams.get("invoice") ?? ""));
    } catch (error) {
      log("control failed:", (error as Error).message);
      return send(500, { error: (error as Error).message });
    }
    // What a browser's presigned PUT to object storage does (the fake storage's URLs are not reachable).
    if (url.pathname === "/storage" && req.method === "PUT") {
      const target = new URL(url.searchParams.get("url") ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      storage.putDirect(
        decodeURIComponent(target.pathname.slice(1)),
        Buffer.concat(chunks),
        String(req.headers["content-type"] ?? "application/octet-stream"),
      );
      return send(200, { ok: true });
    }
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
