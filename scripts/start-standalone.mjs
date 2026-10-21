/**
 * `pnpm start [-p PORT]` — runs the server the image ships (D-230): `next build` with `output: "standalone"` writes
 * `.next/standalone/server.js`; like the Dockerfile, this copies `.next/static` and `public/` beside it and starts it
 * with `node`, so the e2e, integration and Lighthouse runs test the same self-contained server as production
 * (a file the standalone trace missed fails here, not on the platform).
 *
 *   PORT      the listen port (`-p` wins; default 3000)
 *   HOSTNAME  the listen address — set explicitly to START_HOSTNAME (default 0.0.0.0), because shells export
 *             HOSTNAME as the machine name and the standalone server would bind to it
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE = join(ROOT, ".next/standalone");
const SERVER = join(STANDALONE, "server.js");

const args = process.argv.slice(2);
const portFlag = args.findIndex((arg) => arg === "-p" || arg === "--port");
const port = portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || "3000";
if (!port || !/^\d+$/.test(port)) {
  console.error(`start: invalid port ${port ?? "(missing)"}`);
  process.exit(2);
}
if (!existsSync(SERVER)) {
  console.error("start: .next/standalone/server.js is missing — run `pnpm build` first");
  process.exit(2);
}

for (const [from, to] of [
  [join(ROOT, ".next/static"), join(STANDALONE, ".next/static")],
  [join(ROOT, "public"), join(STANDALONE, "public")],
]) {
  rmSync(to, { recursive: true, force: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

const child = spawn(process.execPath, [SERVER], {
  cwd: STANDALONE,
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: process.env.START_HOSTNAME || "0.0.0.0" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
