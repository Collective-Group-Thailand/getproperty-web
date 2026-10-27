# GW2 — Agency workspace (web, after api G2)

Pack: `docs/prompts/G-growth-web.md` GW2 · decisions D-284 (agency free, unlimited), D-287, D-293 (mandates, co-broke, deals, fees), ADR-0008 (money outside the platform) · open O-027 (fee prices).

Contract: already adopted with GW1 (api HEAD G0+G1+G2, Mac `5931568`).

## Onboarding — tenant type `agency`
- `/signup?as=agency`: the landlord sign-up form with agency copy (business name, free and unlimited — D-284), phone OTP → `POST /v1/public/signup/agency[/otp]`, Google / Apple / LINE through the same OAuth attempt (`signupAs: "agency"` in the attempt cookie). After sign-up → `/mandated-units?welcome=1`. Link from the landlord sign-up page and the landlords marketing page.
- `glossary.tenantType.agency`, owner menu keys `mandated_units`, `mandates`, `co_broke`, `deals` → routes; agency bottom nav starts at mandated units.

## Agency (tenant type agency)
- **Mandates inbox** `/mandates` (role = agency): tabs invited / active / ended; accept (Idempotency-Key, restates unit + scope + exclusive + commission), decline (reason), end (typed confirmation of the unit number, reason).
- **Mandated units** `/mandated-units`: the granted portfolio — unit, building, area, scope, exclusive badge, valid to, the agency's listing state, a link to create a listing for the unit (B7 listings, `?unit=`).
- **Co-broke** `/co-broke`: agreements as listing agency and as co-agency; propose (listing of mine, co-agency picked from `GET /v1/owner/agencies`, split %, validity, note; Idempotency-Key), sign as co-agency (Idempotency-Key), cancel / end.
- **Deals** `/deals` + `/deals/{id}`: closed deals with the recorded commission and co-broke share — copy says the money moves between the parties outside getproperty (ADR-0008) — and the fees the tenant owes (success / co-broke fee accruals; "not priced yet → nothing accrued", invoiced later on the getproperty invoice, never deducted from rent).

## Owner side (landlord; mandates menu key)
- `/mandates` (role = owner): mandates on my units with state, agency, scope, exclusive, commission, validity; **invite an agency** (unit from my portfolio, agency search `GET /v1/owner/agencies?q=`, scope, exclusive, commission text / % of one month / fixed amount, valid from / to; Idempotency-Key), **revoke** with typed confirmation of the unit number (+ reason; access ends at once, the agency's listing closes — copy says so), end.
- Portfolio unit row: "Invite an agency" link (`/mandates?invite=<unitId>`).
- Deals `/deals` for the owner (deals on my units).

## Mocks
`mocks/owner/agency.ts` with state `state.agency` (agencies, mandates, co-broke agreements, deals) — reset part `agency`; an `agency` persona (phone 0810000009, tenant บ้านดี พร็อพเพอร์ตี้ type agency) with the agency menu; landlord persona gets mandates + deals keys; public sign-up handlers for agency.

## Contract requests
Whatever GW2 needs and the API lacks goes to `docs/contract-requests.md`.

## Tests
Unit: menu mapping, status maps (`mandate`, `coBroke`). e2e `owner-agency.spec.ts`: landlord invites → agency accepts → mandated unit visible → landlord revokes with typed confirmation → unit gone; exclusive conflict problem shown; co-broke propose / sign; deals list with the "outside the platform" copy; agency sign-up; axe on each page.
