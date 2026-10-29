# GW5 — Sponsored broadcast (web, after api G6)

Pack: `docs/prompts/G-growth-web.md` GW5 · decisions **D-300** (audience, marketing consent, sponsored broadcast),
D-287 (growth streams), D-291 (every price / cap / window is data), D-025 (PDPA), D-298 (no wallet), D-268 (short
links) · open **O-023** (LINE Thailand has not confirmed: `broadcast.sponsored.enabled` is off), **O-027** (no price per
recipient yet, minimum 500 by default), O-020 (gateway skipped).

Contract: Mac api `b22571de1deb` = sandbox `e8b5a1b` (G8 + G6 on top of G5). Adopt with
`API_CONTRACT_REF=e8b5a1b82519378b5a1ad74750055633348c00dc pnpm gen:api --adopt` (never HEAD — G9 commits there),
lock `apiCommit` = `b22571de1deb`; `docs/decisions.md` re-synced from that commit (D-299, D-300, O-023 / O-027 notes,
O-033, O-034). G8 brings export kind `payroll_deduction` (file extension map) and channel `line_sponsored` — G8's
screens (handoffs, employer housing, relocation) are GW6.

## Navigation (no new menu keys in the contract)
- Owner: `/promote` gets link tabs *Boosts and photo services* · *LINE broadcasts*; the broadcasts live at
  `/promote/broadcasts`, `/promote/broadcasts/new` (`?listing=` preselects one), `/promote/broadcasts/{id}`. A listing's
  promote card links to a new campaign with that listing. Contract request: owner menu key `promotion` (already
  requested in GW4) covers it.
- Admin: campaigns = a tab of Listings (`/listings/broadcasts`, list `admin.tenant.read`, reject
  `admin.listing.moderate` — the moderation team); settings and the consent text = `/settings/broadcast` linked from
  Settings (`admin.setting.manage`). Contract request: admin menu key `broadcast` (optional — Settings / Listings carry it).

## Owner zone
- **Availability card** (product): four states designed, never a price invented —
  *not available yet* (switch off, O-023: drafting and estimating work, sending waits), *not on sale yet* (no price,
  O-027), both, or *open* (price per delivered recipient before VAT, minimum recipients, listings per campaign,
  weekly cap per person). "Billed per delivered recipient after sending; one invoice, no credit or wallet".
- **How it works / privacy**: only people who chose to receive recommendations, matched on what they typed; you see
  numbers only, never who; every message is labelled as an ad and has a one-tap stop.
- **Campaign list** by state tabs (all / draft / scheduled / sending / sent), each with listings, schedule, estimate or
  delivered, clicks, invoice.
- **Builder** `/promote/broadcasts/new`: name; my **published** listings (checkbox cards with rent / area / kind, at most
  `maxListings`); segment (areas from the public area list with a filter, budget range, unit kinds, move-in window,
  languages — the closed whitelist, nothing else); max recipients. Sticky summary: **live estimate** (debounced
  `POST …/estimate`; *fewer than {minimum} — the number is not shown*, privacy) and **cost preview** from the API
  (subtotal, VAT, total for the estimate — "at most"; or not on sale). *Save draft* (Idempotency-Key) → campaign page.
  No published listing → empty state to the listings.
- **Campaign page** `/promote/broadcasts/{id}`: state, what / who / how many, price snapshot once scheduled;
  draft → *Schedule* (now or a Bangkok date-time ≤ 90 days; confirmation restates recipients, price per recipient and
  the preview total from a fresh estimate; Idempotency-Key) and *Cancel*; scheduled → *Cancel*. Schedule refusals as
  designed states: `broadcast.sponsored_disabled`, `broadcast.not_on_sale`, `broadcast.below_minimum`,
  `broadcast.listing_not_public`, `broadcast.invalid_state`. A listing no longer public is flagged before scheduling.
  **Report** (sending / sent): sent, opened (not available for LINE multicast — explained), clicks, leads within the
  attribution days, the invoice. Rejected → the platform's reason; cancelled → nothing sent or billed.
- `/s/<code>`: the API answers channel `line_sponsored` (UTM line / sponsored) — the short-link page already passes
  `ch`; the LINE contact button's channel allow-list gets `line_sponsored` (and `facebook_page`), lead detail labels them.

## Admin zone
- **Listings › LINE broadcasts** `/listings/broadcasts`: every buyer's campaigns (state filter), tenant, listings,
  schedule, estimate / delivered / clicks, price snapshot, invoice; *Reject* with a reason (draft / scheduled / sending;
  not billed; `broadcast.invalid_state` explained).
- **Settings › Sponsored broadcast** `/settings/broadcast`: switch state with the O-023 explanation and people
  consenting (aggregate); form of the eight values (enabled, weekly cap, quiet hours, listings per campaign, send window,
  attribution days, delivery retention, preference retention) + required reason; switching on asks to confirm LINE's
  written confirmation; only changed values are sent. **Consent text** in force (version, from, th / en title + text)
  and *Publish a new version* (th + en, from now or later, warning: everyone is asked again; Idempotency-Key).

## Mocks
`mocks/owner/broadcast.ts` (state `broadcast`, reset part `broadcast`): product off and unpriced by default; consenting
audience of 1,240 people spread over areas / budgets / kinds / languages (aggregate counting only); estimate,
drafts, schedule rules in the API's order, cancel, report; controls `POST /__mock/owner/broadcast/enable[?on=0]`,
`…/price[?price=]`, `…/send?campaign=` (job: scheduled → sent with delivered / clicks / leads and a purchase invoice).
`mocks/platform/broadcast.ts`: admin list / reject, settings GET / PUT, consent text publish (consenting → 0).

## Tests
Unit: status map `sponsoredCampaign` (coverage test), segment helpers (`broadcast.ts`: body from the form, readable
segment, per-recipient price trimming), ChannelLink accepts `line_sponsored`. e2e written, not run (deferred):
`owner-broadcast.spec.ts` (not available → builder estimate withheld / shown → draft → schedule refused disabled →
enabled + priced → scheduled → sent report; cancel), `admin-broadcast.spec.ts` (settings switch with reason, consent
text v2, reject). lint, typecheck, unit (under the lock), build, build-storybook, Lighthouse if it runs here.
