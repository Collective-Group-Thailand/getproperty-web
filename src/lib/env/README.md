# src/lib/env

Every environment variable the app reads, validated with zod (F1 1.1). `schema.ts` is pure (the unit
test feeds it any environment); `server.ts` parses `process.env` once per process and is called by
`src/instrumentation.ts` at boot, so an invalid deployment refuses to start and lists every problem;
`client.ts` is the `NEXT_PUBLIC_*` half the browser may read. `.env.example` documents each variable.
