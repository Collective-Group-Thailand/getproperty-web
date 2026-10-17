/**
 * Generates the typed API surface from `getproperty-api`'s OpenAPI contract (ADR-0005, F1 1.2).
 *
 *   pnpm gen:api           regenerate from the vendored contract
 *   pnpm gen:api --check   fail if any committed output is stale or was hand-edited (CI `contract` job)
 *   pnpm gen:api --adopt   copy the contract named by API_CONTRACT_SOURCE into contract/openapi.json,
 *                          rewrite contract.lock.json (version, sha256, source, api commit), regenerate
 *
 * Written, all committed:
 *   src/lib/api/schema.d.ts               the only source of API types (CLAUDE.md)
 *   src/lib/api/generated/operations.ts   per-operation flags the clients act on (Idempotency-Key,
 *                                         If-Match, tenant header) keyed by "METHOD /path/{template}"
 *   mocks/generated/operations.ts         MSW base data: every operation of the surfaces this app
 *                                         reaches (auth, owner, staff, admin) with its success example
 *   mocks/generated/problems.ts           every documented problem example, and which codes each
 *                                         operation documents per status — the error-path handlers
 *
 * Why a vendored copy rather than fetching here: CI has no sibling checkout of getproperty-api and no
 * credentials for a private release asset, so the drift gate has to be reproducible offline.
 * `--adopt` is the one command that reaches outside this repo; it rewrites the vendored copy and the
 * lock together so bumping the pinned contract is a reviewable act.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = resolve(ROOT, "contract.lock.json");
const VENDORED = resolve(ROOT, "contract/openapi.json");
const OUT_SCHEMA = resolve(ROOT, "src/lib/api/schema.d.ts");
const OUT_OPERATIONS = resolve(ROOT, "src/lib/api/generated/operations.ts");
const OUT_MOCK_OPERATIONS = resolve(ROOT, "mocks/generated/operations.ts");
const OUT_IDEMPOTENT = resolve(ROOT, "src/lib/api/generated/idempotent.ts");
const OUT_MOCK_PROBLEMS = resolve(ROOT, "mocks/generated/problems.ts");

/** Surfaces this app talks to. `/v1/resident`, `/v1/technician` belong to getproperty-liff (D-154). */
const APP_SURFACES = ["/v1/auth/", "/v1/owner/", "/v1/staff/", "/v1/admin/"];

interface ContractLock {
  $comment?: string;
  /** `info.version` of the vendored document. */
  version: string;
  sha256: string;
  /** Where `--adopt` took it from (a path or URL) — documentation, never fetched automatically. */
  source: string;
  /** getproperty-api commit the contract was adopted from, when the source was a git checkout. */
  apiCommit?: string;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return undefined;
  }
}

/**
 * Reads the contract to adopt. From a git checkout of getproperty-api only a **committed** contract is
 * adopted — `API_CONTRACT_REF` (default `HEAD`) names the commit — so the lock always points at a
 * version that exists in the backend's history; a working copy with uncommitted contract changes is
 * refused unless `--allow-dirty`. A source outside git (a downloaded release asset) is read as is.
 */
function readSource(path: string): { text: string; apiCommit?: string } {
  const dir = dirname(path);
  const top = git(dir, ["rev-parse", "--show-toplevel"])?.trim();
  if (!top) return { text: readFileSync(path, "utf8") };
  const relativePath = relative(top, path);
  const ref = process.env.API_CONTRACT_REF ?? "HEAD";
  const dirty = git(top, ["status", "--porcelain", "--", relativePath])?.trim();
  if (dirty && !process.env.API_CONTRACT_REF && !process.argv.includes("--allow-dirty")) {
    console.error(
      `${relativePath} has uncommitted changes in ${top}. Adopt a commit (API_CONTRACT_REF=<sha>) or pass --allow-dirty.`,
    );
    process.exit(1);
  }
  if (dirty && process.argv.includes("--allow-dirty") && !process.env.API_CONTRACT_REF) {
    return {
      text: readFileSync(path, "utf8"),
      apiCommit: `${git(top, ["rev-parse", "--short=12", "HEAD"])?.trim()}+dirty`,
    };
  }
  const text = git(top, ["show", `${ref}:${relativePath}`]);
  if (text === undefined) {
    console.error(`${ref}:${relativePath} does not exist in ${top}.`);
    process.exit(1);
  }
  return { text, apiCommit: git(top, ["rev-parse", "--short=12", ref])?.trim() };
}

function adopt(): void {
  const source = process.env.API_CONTRACT_SOURCE ?? "../getproperty-api/contract/openapi.json";
  const path = resolve(ROOT, source);
  if (!existsSync(path)) {
    console.error(
      `API_CONTRACT_SOURCE (${source}) does not exist. Point it at getproperty-api's contract/openapi.json.`,
    );
    process.exit(1);
  }
  const { text, apiCommit } = readSource(path);
  const document = JSON.parse(text) as { info?: { version?: string } };
  mkdirSync(dirname(VENDORED), { recursive: true });
  writeFileSync(VENDORED, text);
  const lock: ContractLock = {
    $comment:
      "The getproperty-api contract this frontend is generated from. Change with `pnpm gen:api --adopt`, never by hand.",
    version: document.info?.version ?? "0.0.0",
    sha256: sha256(text),
    source,
    apiCommit,
  };
  writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  console.info(
    `adopted contract ${lock.version} (${lock.sha256.slice(0, 12)}) from ${source} @ ${apiCommit ?? "file"}`,
  );
}

// ── Contract walking ────────────────────────────────────────────────────────────────────────────

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface Ref {
  $ref: string;
}
interface Parameter {
  name?: string;
  in?: string;
  required?: boolean;
}
interface MediaType {
  example?: Json;
  examples?: Record<string, { value?: Json } | Ref>;
}
interface Response {
  description?: string;
  content?: Record<string, MediaType>;
}
interface Operation {
  operationId?: string;
  security?: Record<string, string[]>[];
  parameters?: (Parameter | Ref)[];
  responses?: Record<string, Response | Ref>;
}
interface Document {
  paths: Record<string, Record<string, Operation>>;
  components: {
    parameters?: Record<string, Parameter>;
    examples?: Record<string, { summary?: string; value?: Json }>;
  };
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

function deref<T>(document: Document, value: T | Ref): T {
  if (value && typeof value === "object" && "$ref" in value) {
    const parts = value.$ref.replace(/^#\//, "").split("/");
    let node: unknown = document;
    for (const part of parts) node = (node as Record<string, unknown>)[part];
    return node as T;
  }
  return value as T;
}

function parameterNames(document: Document, operation: Operation): Set<string> {
  return new Set(
    (operation.parameters ?? []).map((p) => {
      const param = deref<Parameter>(document, p);
      return `${param.in}:${param.name?.toLowerCase()}`;
    }),
  );
}

interface OperationMeta {
  id: string;
  method: Uppercase<(typeof METHODS)[number]>;
  path: string;
  idempotencyKey: boolean;
  ifMatch: boolean;
  tenantHeader: boolean;
}

interface MockOperation {
  id: string;
  method: (typeof METHODS)[number];
  path: string;
  /** The operation requires a bearer (an empty `security` means public, e.g. `/v1/admin/system/info`). */
  secured: boolean;
  status: number;
  contentType: string | null;
  example: Json | undefined;
}

function walk(document: Document) {
  const operations: OperationMeta[] = [];
  const mocks: MockOperation[] = [];
  const problemsByOperation: Record<string, Record<string, number>> = {};

  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation?.operationId) continue;
      const params = parameterNames(document, operation);
      operations.push({
        id: operation.operationId,
        method: method.toUpperCase() as OperationMeta["method"],
        path,
        idempotencyKey: params.has("header:idempotency-key"),
        ifMatch: params.has("header:if-match"),
        tenantHeader: params.has("header:x-tenant-id"),
      });

      if (!APP_SURFACES.some((prefix) => path.startsWith(prefix))) continue;

      const responses = Object.entries(operation.responses ?? {}).map(
        ([status, response]) => [status, deref<Response>(document, response)] as const,
      );
      const success = responses.find(([status]) => /^2\d\d$/.test(status));
      if (success) {
        const [status, response] = success;
        const [contentType, media] = Object.entries(response.content ?? {})[0] ?? [null, undefined];
        let example: Json | undefined = media?.example;
        if (example === undefined && media?.examples) {
          const first = Object.values(media.examples)[0];
          example = first ? deref<{ value?: Json }>(document, first).value : undefined;
        }
        mocks.push({
          id: operation.operationId,
          method,
          path,
          secured: (operation.security ?? []).length > 0,
          status: Number(status),
          contentType,
          example,
        });
      }

      const problems: Record<string, number> = {};
      for (const [status, response] of responses) {
        if (!/^[45]\d\d$/.test(status)) continue;
        for (const media of Object.values(response.content ?? {})) {
          for (const [code] of Object.entries(media.examples ?? {})) problems[code] = Number(status);
        }
      }
      problemsByOperation[operation.operationId] = problems;
    }
  }

  operations.sort((a, b) => a.id.localeCompare(b.id));
  mocks.sort((a, b) => a.id.localeCompare(b.id));

  const problemExamples: Record<string, Json> = {};
  for (const [name, example] of Object.entries(document.components.examples ?? {})) {
    if (!name.startsWith("problem.")) continue;
    if (example.value !== undefined) problemExamples[name.slice("problem.".length)] = example.value;
  }
  return { operations, mocks, problemsByOperation, problemExamples };
}

// ── Emitters ───────────────────────────────────────────────────────────────────────────────────

function banner(lock: ContractLock, purpose: string): string {
  return `/* GENERATED by pnpm gen:api from contract/openapi.json (getproperty-api ${lock.version}, sha256 ${lock.sha256.slice(0, 12)}) — do not edit. */\n/* ${purpose} */\n`;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

function emitOperations(lock: ContractLock, operations: OperationMeta[]): string {
  const byKey = Object.fromEntries(
    operations.map((op) => [
      `${op.method} ${op.path}`,
      { id: op.id, idempotencyKey: op.idempotencyKey, ifMatch: op.ifMatch, tenantHeader: op.tenantHeader },
    ]),
  );
  return `${banner(lock, "Per-operation flags the API clients act on (src/lib/api/client.ts).")}
export interface OperationFlags {
  /** \`operationId\` (\`<surface>.<resource>.<action>\`). */
  readonly id: string;
  /** The contract requires \`Idempotency-Key\` (irreversible POSTs); the client adds one when missing. */
  readonly idempotencyKey: boolean;
  /** The contract requires \`If-Match\` (optimistic concurrency). */
  readonly ifMatch: boolean;
  /** The operation accepts \`X-Tenant-Id\`. */
  readonly tenantHeader: boolean;
}

/** Keyed by \`"METHOD /path/{template}"\` exactly as \`schema.d.ts\` names the path. */
export const OPERATIONS: Readonly<Record<string, OperationFlags>> = ${json(byKey)};
`;
}

/**
 * The one flag the client acts on at runtime, as a small set: `OPERATIONS` (every flag of every
 * operation) stays out of the browser bundle (D-179).
 */
function emitIdempotent(lock: ContractLock, operations: OperationMeta[]): string {
  const keys = operations
    .filter((op) => op.idempotencyKey)
    .map((op) => `${op.method} ${op.path}`)
    .sort();
  return `${banner(lock, "Operations whose contract requires Idempotency-Key (src/lib/api/client.ts adds one when missing).")}
/** \`"METHOD /path/{template}"\` exactly as \`schema.d.ts\` names the path. */
export const IDEMPOTENT_OPERATIONS: ReadonlySet<string> = new Set(${json(keys)});
`;
}

function emitMockOperations(lock: ContractLock, mocks: MockOperation[]): string {
  return `${banner(lock, "MSW base data: the success example of every operation this app can reach (mocks/handlers/generated.ts).")}
export interface MockOperation {
  readonly id: string;
  readonly method: "get" | "post" | "put" | "patch" | "delete";
  readonly path: string;
  readonly secured: boolean;
  readonly status: number;
  readonly contentType: string | null;
  readonly example?: unknown;
}

export const MOCK_OPERATIONS: readonly MockOperation[] = ${json(mocks)};
`;
}

function emitProblems(
  lock: ContractLock,
  problemsByOperation: Record<string, Record<string, number>>,
  problemExamples: Record<string, Json>,
): string {
  return `${banner(lock, "Documented problem examples (RFC 9457) and the codes each operation documents — error-path mocks.")}
/** Every \`problem.<code>\` example in \`components.examples\`, keyed by code. */
export const PROBLEM_EXAMPLES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = ${json(problemExamples)};

/** \`operationId\` → { problem code → HTTP status } as documented on that operation. */
export const OPERATION_PROBLEMS: Readonly<Record<string, Readonly<Record<string, number>>>> = ${json(problemsByOperation)};
`;
}

async function generate(check: boolean): Promise<void> {
  const text = readFileSync(VENDORED, "utf8");
  const lock = JSON.parse(readFileSync(LOCK, "utf8")) as ContractLock;
  if (sha256(text) !== lock.sha256) {
    console.error("contract/openapi.json does not match contract.lock.json — run `pnpm gen:api --adopt`.");
    process.exit(1);
  }

  const header = `/* GENERATED by pnpm gen:api from contract/openapi.json (getproperty-api ${lock.version}) — do not edit. */\n`;
  const ast = await openapiTS(new URL(`file://${VENDORED}`), { alphabetize: true });
  const document = JSON.parse(text) as Document;
  const walked = walk(document);

  const outputs: [string, string][] = [
    [OUT_SCHEMA, header + astToString(ast)],
    [OUT_OPERATIONS, emitOperations(lock, walked.operations)],
    [OUT_IDEMPOTENT, emitIdempotent(lock, walked.operations)],
    [OUT_MOCK_OPERATIONS, emitMockOperations(lock, walked.mocks)],
    [OUT_MOCK_PROBLEMS, emitProblems(lock, walked.problemsByOperation, walked.problemExamples)],
  ];

  if (check) {
    const stale = outputs.filter(([path, content]) => !existsSync(path) || readFileSync(path, "utf8") !== content);
    if (stale.length > 0) {
      for (const [path] of stale) console.error(`${relative(ROOT, path)} is out of date`);
      console.error("Run `pnpm gen:api` and commit the result.");
      process.exit(1);
    }
    console.info(`generated API files are up to date (${walked.operations.length} operations)`);
    return;
  }

  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.info(`wrote ${relative(ROOT, path)}`);
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  if (process.argv.includes("--adopt")) adopt();

  if (!existsSync(VENDORED) || !existsSync(LOCK)) {
    console.error(
      "No contract vendored (contract/openapi.json + contract.lock.json). Run `pnpm gen:api --adopt` with API_CONTRACT_SOURCE pointing at getproperty-api's contract.",
    );
    process.exit(1);
  }
  await generate(check);
}

void main();
