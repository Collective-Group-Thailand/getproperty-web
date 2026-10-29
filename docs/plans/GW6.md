# GW6 — Self-viewing, getbuild handoff, employer housing, reviews, energy, listing assistant (web, after api G7–G9)

Pack: `docs/prompts/G-growth-web.md` GW6 · decisions **D-295** (self-viewing), **D-299** (getbuild handoff, employer
housing, relocation), **D-301** (reviews, listing assistant, energy insight), D-289, D-025, D-040, D-161, D-238 · open
**O-024** (insurance / visitor terms — `viewing.self.enabled` off), **O-031** (agency on owner lock, terms wording,
log retention), **O-033** (getbuild API), **O-034** (payroll deduction law), **O-035** (review moderation), **O-036**
(energy score model, lead contents); O-009 (AI cost) / O-028 (getenergy contract) notes.

Contract: Mac api `02ab053ebf8d` = sandbox api HEAD `0fefa43` (G9 on top of G6/G8/G7). Adopt with
`API_CONTRACT_REF=0fefa4368e5a966fb20b06ecf0d246544e6f0a41 pnpm gen:api --adopt`, lock `apiCommit` = `02ab053ebf8d`;
`docs/decisions.md` re-synced from that commit (D-301, O-035, O-036, O-009 / O-028 notes).

## Navigation (no new menu keys in the contract → contract requests)
- Owner: viewing calendar `/leads/viewings` (link from the enquiries page; `leads` menu); handoffs
  `/listings/handoffs` + `/listings/handoffs/claim?token=` (link from the listings page when there is one, and from the
  public invitation); employer housing `/employers`, `/employers/{id}` (a tab of the lease section, `ContractsNav`);
  reviews `/reviews` (listings page header + building page). Requests: `OwnerMenuKey` `reviews`, `employer_housing`.
- Admin: Listings tabs *Reviews* `/listings/reviews` (`admin.listing.moderate`) and *getbuild handoffs*
  `/listings/handoffs` (`admin.tenant.read`; resend `admin.tenant.manage`). Request: `AdminMenuKey` `reviews`.
- Public: `/handoff/{token}` (no index, no cache) and a reviews block on `/rent/{slug}`.

## G7 — self-viewing (owner / agency side)
- Availability editor: each weekly window gets a mode (accompanied / self). `viewing.self.enabled` read from
  `GET /v1/owner/settings`: off → designed *not available yet* card (O-024: insurance and visitor terms), the self
  option disabled, existing self windows kept as the API holds them. On → how it works (verified prospects, door code
  from N minutes before to M minutes after the start — values from the settings, you still confirm each one, codes are
  never shown to you).
- Enquiry viewings: mode badge; confirming a self viewing says door codes are issued at confirmation; **access card**
  (state, code window, entered / exited with source, incident note + link to the work order, closed reason); **entry
  log** dialog (`GET …/access-log`, audited — the dialog says so; locks, credentials window / status, door events; no
  code anywhere); **end access now** (reason, Idempotency-Key per opening) while issued / entered.
- Viewing calendar `/leads/viewings`: a week agenda (`?week=YYYY-MM-DD`, `from` / `to` to the API), grouped by day,
  mode + access state per row, links to the enquiry; *needs attention* callout when a self viewing has a visitor
  inside, an incident or an overstay.
- Notifications: `listing.self_viewing_entered|incident|overstayed` open the calendar.

## G8 — getbuild handoff, employer housing (owner) — relocation is never shown to the landlord
- Public `/handoff/{token}`: the unit facts, the buyer's first name, transfer date, expiry; states invited / accepted /
  listed / declined / expired / unknown; *List it for rent* → console claim (sign-in or sign-up keeps `next`);
  *Not now* → decline (Server Action, confirmation).
- Claim `/listings/handoffs/claim?token=`: facts, rent (decimal string), Thai / English title (prefilled suggestion
  from the facts), address only when getbuild did not tell it; Idempotency-Key per page; `handoff.landlord_required`
  (an apartment / agency account) and `handoff.invalid_state` as designed states → opens the listing draft.
- `/listings/handoffs`: claimed handoffs with state, campaign, listing link.
- Employer housing `/employers`: agreements (employer, building, split rule, deduct %, valid, workers, leases, state);
  create dialog (employer = an organisation party, building or all, split, deduct %, reference, dates).
  `/employers/{id}`: facts + edit (If-Match) / end (typed confirmation), worker payroll numbers (`PUT …/workers`),
  leases attached, statement of a month (lines, shares, deductions, employer pays, totals — all API strings),
  payroll CSV export (`POST …/payroll-exports` → export job → BFF download), TM30 of these workers
  (`/tm30?employer=`). Lease page: *Employer pays* card (attach / detach, `PUT /leases/{id}/employer`; next invoices
  only, D-040). TM30 page honours `employer` (`employerAgreementId`).
- Admin `/listings/handoffs`: every handoff, delivery attempts / last error, resend (Idempotency-Key).

## G9 — reviews, listing assistant, energy insight
- Owner `/reviews`: summary per building (count, average from the API list), filters building / state, each review
  (rating, text, tenure months, state, moderation reason when hidden, report stamp); reply (create / edit, ≤ 1000,
  screened by the API — field error shown), report (reason). **No hide / delete button**; copy says only the
  getproperty team moderates.
- Listing editor *Draft with AI*: availability / quota (`GET /v1/owner/listing-assistant`), languages th / en / zh,
  include photos (read only), generate (Idempotency-Key per request), drafts with *Use in Thai / English fields*
  (fills the form, the owner saves with the existing PATCH) and copy for zh; disclaimer always shown; 429
  `assistant.limit_reached`, 503 `assistant.unavailable`, 502 `assistant.output_rejected`, 409 `assistant.disabled`
  as designed states.
- Building page *Energy insight*: score ring, metrics (kWh, common share, peak, load factor, pump hours, basis,
  window), penalties, `insufficient_data` state; opt-in with the consent text from the API (checkbox never pre-ticked,
  `consentVersion`, Idempotency-Key), opted-in state (last shared, what is shared: aggregates only), opt-out; operator
  without ownership (`canOptIn: false`) reads only.
- Admin `/listings/reviews`: tabs pending / reported / hidden / all; approve, reject (reason), hide (reason),
  restore, dismiss report; Idempotency-Key on approve / reject / hide / restore.
- Public listing page: verified reviews (summary, distribution, paged with `?reviews=n`, "verified tenant", tenure
  months, owner reply) — server-rendered, no JS; nothing shown when there are none.

## Mocks, tests, docs
- MSW: viewing mode / access / access-log / end-access; handoffs (public, owner, admin); employer agreements,
  workers, statement, payroll export, lease employer, TM30 filter; reviews (owner, admin, public); energy insight;
  listing assistant (quota, drafts, limit). Controls under `/__mock/owner/insight/*`.
- Unit: pure helpers (week range, access tone / attention, review summary, energy display, claim title suggestion).
- e2e written, not run (deferred): `owner-self-viewing.spec.ts`, `owner-network.spec.ts` (handoff + employer),
  `owner-insight.spec.ts` (reviews, energy, assistant), `admin-insight.spec.ts`; existing specs touched by the
  availability editor kept in step.
- Gates: lint, format:check, typecheck, unit, build, build-storybook, Lighthouse owner + admin + marketing sets.
