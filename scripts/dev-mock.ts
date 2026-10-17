/**
 * `pnpm dev:mock` — the app against the mock API, no backend needed: starts `mocks/server.ts` on
 * MOCK_API_PORT (default 4010) and `next dev` with API_INTERNAL_URL pointing at it. Personas and
 * codes are listed in mocks/README.md.
 */
import { spawn } from "node:child_process";

const port = process.env.MOCK_API_PORT ?? "4010";
const env = { ...process.env, MOCK_API_PORT: port, API_INTERNAL_URL: `http://127.0.0.1:${port}` };

const children = [
  spawn("pnpm", ["exec", "tsx", "mocks/server.ts"], { stdio: "inherit", env }),
  spawn("pnpm", ["exec", "next", "dev", ...process.argv.slice(2)], { stdio: "inherit", env }),
];

const stop = (code = 0) => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
};
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
