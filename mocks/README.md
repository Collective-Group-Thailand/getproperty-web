# mocks — the mock API

`getproperty-api`'s contract served over real HTTP from MSW handlers (`tsx mocks/server.ts`, port
`MOCK_API_PORT`, default 4010). `pnpm dev:mock` starts it next to `next dev` with `API_INTERNAL_URL`
pointing at it; the Playwright `chromium` project does the same against a production build. Running
it as its own process (rather than MSW inside the Next server) exercises the BFF, cookies, streaming
and headers exactly as against the real backend, and lets the suite read what the "API" received.

- `generated/` — written by `pnpm gen:api` from the vendored contract, never by hand: every operation
  this app can reach with its success example (`operations.ts`) and every documented problem example
  with the codes each operation documents (`problems.ts`). `handlers/support.ts#problem()` refuses to
  answer a code an operation does not document, so error paths stay the API's.
- `handlers/` — hand-written, stateful overrides: auth (OTP, password + TOTP, platform enrolment,
  refresh rotation with reuse detection, logout), `/me` per surface, and the generated base handlers
  with audience, tenant-context and read-only (D-082) behaviour. A handler for an endpoint the contract
  does not have yet is marked `// CONTRACT-REQUEST` and listed in `docs/contract-requests.md`.
- `fixtures.ts` — personas, typed against the generated schema. OTP and authenticator code `123456`,
  password `correct horse battery staple`:

  | Persona   | Sign-in                             | Situation                                 |
  | --------- | ----------------------------------- | ----------------------------------------- |
  | owner     | `0810000001` or `owner@example.com` | one tenant (หอพักตัวอย่าง), Owner         |
  | multi     | `0810000002`                        | two tenants → tenant picker / switcher    |
  | suspended | `0810000003`                        | suspended subscription → read-only banner |
  | staff     | `0810000004`                        | Staff role, English                       |
  | totp      | `totp@example.com`                  | password + TOTP                           |
  | admin     | `admin@example.com`                 | platform, TOTP enrolment at first sign-in |
  | support   | `support@example.com`               | platform, already enrolled                |

- `state.ts` — the mock's memory; `server.ts` documents the `/__mock/*` control endpoints.
