# GW4 — Distribution & growth billing (web, after api G4 + G5)

Pack: `docs/prompts/G-growth-web.md` GW4 · decisions D-296 (distribution), D-297 (boosts, growth fees, media orders),
D-298 (no stored-value wallet), D-288 (Facebook: Page only, groups never automated), D-287 / D-291 (every price is a
price-plan version), D-293 (fee accruals), D-091 (credit notes maker-checker), D-250 (unpaid never suspends) · open
O-027 (every growth price — all G5 products and the OA add-on are seeded **without a price**), O-029 (Meta app review,
`FACEBOOK_MODE` off in production), O-032 (verified photo / 360° partner), O-020 (gateway skipped).

Contract: Mac api `8195e78d0f34` = sandbox `8c5b845` (G7 + G4 + G5 on top of G3). Adopt with
`API_CONTRACT_REF=8c5b8452124dcab87e3a131b1fd7060420779cc5 pnpm gen:api --adopt` (never HEAD: G8 commits there
meanwhile), lock `apiCommit` = `8195e78d0f34`; `docs/decisions.md` re-synced from that commit (D-295…D-298, O-031,
O-032). Mocks the new required fields break are filled (public listing `verifiedVacant` / `vacantSince` /
`sponsored` / `sponsoredLabel` / `jsonLd` / `ogImageUrl`, share kit `photos`, viewing `mode` / `access` of G7 —
G7's screens themselves are GW6).

## Navigation (no new menu keys in the contract)
- Owner: the promotion page `/promote` hangs off the listings page (header action), the listing page and a building page;
  contract request: an owner menu key `promotion`. Facebook Page = a settings tab beside LINE OA (shown with the
  `settings` key, like `line_oa`).
- Admin: fee accruals = a tab of Subscriptions (`/subscriptions/fees`, key `subscriptions`, read
  `admin.tenant.read`, dispute `admin.platform_invoice.issue`); media orders = a tab of Listings
  (`/listings/media`, `/listings/media/{id}`, key `listings`, permission `admin.listing.verify` — the team that
  verifies owners books the photographer).

## Public zone (D-296, D-297)
- `/rent/{slug}`: the API's `jsonLd` embedded as `application/ld+json` (plus the breadcrumb graph; the local
  builder goes), `og:image` / `twitter:image` = `ogImageUrl` (1200 × 630); **verified-vacant badge** "ว่างจริง"
  with *since {vacantSince}* in the header and the price card, explained in one line (from getproperty's own lease
  records, never the owner's say-so).
- Search / area / owner / similar cards: verified-vacant badge on the photo; a sponsored card carries the API's
  `sponsoredLabel` ("โฆษณา" / "Ad") as a visible label on the photo and an accessible name — never our own wording,
  never hidden. Real utility cost and area / budget search already exist (B7.9) — unchanged.

## Owner zone
- **Settings › Facebook Page** `/settings/facebook-page`: the connected Page (name, page id, state badge
  verified / failing / revoked, auto-post, verified / checked time, the provider's error when failing), *Connect*
  (Page id + Page access token, password field, auto-post switch; `facebook.page_refused` 422 and
  `facebook.unavailable` 503 explained — "not switched on yet" while O-029), *Check again*, *Disconnect*
  (confirmation: posts already on the Page stay). How-to and the D-288 note: groups and Marketplace are never posted
  automatically — the share kit is for them.
- **Listing page**: *Facebook Page posts* card (`GET …/social-posts`): per Page the state (queued with what is about
  to happen, posted with a link, failed with the reason and attempts, deleted), *Retry* on failed (Idempotency-Key,
  `social.post_invalid_state` explained); without a Page a link to the settings tab. **Share kit**: the photo bundle
  (each 1600 px photo, download one by one, in order) under the cards.
- **Listing page › Promote**: the listing boost products (7 / 30 days) with price incl. VAT, or *"ยังไม่เปิดขาย"*
  (not on sale yet) while `onSale` is false — no buy button, no price invented; *Boost* confirmation restates
  product, duration, total incl. VAT and that it starts when the invoice is paid (queued after one in force);
  Idempotency-Key; `boost.pending` / `boost.listing_not_public` / `boost.not_on_sale` shown; this listing's boosts
  (state, window, invoice link). **Verified photo / 360°** products with the same not-on-sale state; *Order*
  (note for the photographer; Idempotency-Key; `media_service.order_open`); this listing's orders.
- **Promotion** `/promote`: all boosts (listing and building) with state tabs (all / active / waiting for
  payment / ended), window, price, invoice; **building boost** per building I run (free when the API says `free`,
  else price or not on sale; `boost.already_active`); all media orders (state, scheduled visit, delivered files
  count, invoice). No wallet, no credits (D-298): every purchase is an invoice on the subscription page.
- **Settings › LINE OA** (agency, D-287): the integration add-on card from `GET /v1/owner/messaging/addons` — not on
  sale → "connecting is free for now"; priced → monthly fee and setup fee (VAT rate, effective from), whether the
  setup fee was charged, the fee invoices. *Connect* asks the operator to accept the prices in force
  (`acceptAddonVersionId`); a 409 `messaging.addon_terms_required` (prices changed meanwhile) shows the prices from
  the problem and asks again.

## Admin zone
- **Subscriptions › Growth fees** `/subscriptions/fees`: accruals of every agency (state tabs uninvoiced /
  invoiced / disputed / credited, tenant search), each with unit, kind (success / co-broke), basis (percent of /
  per deal, rate, base), amount, capped, accrued on, invoice link, credit note (number, state, amount); *Dispute*
  (reason → credit note requested, maker) on invoiced ones; the note is approved or rejected by another platform user
  on the invoice page (link) — D-091; `fee.not_invoiced` / `fee.already_disputed` explained.
- **Listings › Photo services** `/listings/media` + `/listings/media/{id}`: orders by state; the order page shows
  tenant, listing, unit, service, price, invoice, note, partner ref, visit; actions by state: *Schedule* (visit
  date-time + partner reference; requested / scheduled), *Upload deliverables* (photos → presign each as a document
  of the ordering tenant, PUT, then *Deliver* with the document ids; `storage.allowance_exceeded` explained),
  *Cancel* (reason; money back only by a credit note through Finance — copy says so).

## Mocks
`mocks/owner/growth.ts` (state `growth`, reset part `growth`): products unpriced by default; controls
`POST /__mock/owner/growth/price?product=<key>|all|addon` (publish a price), `…/pay?boost=|order=` (Finance records
the payment → boost active / order requested), `…/free-building` (the tenant gets a free building boost); boosts
(queue after an active one), media orders, Facebook Page (`fake-page-token-<name>` verified, `…revoked…` refused,
`FACEBOOK_MODE` off control), social posts per listing (published listing posted; a failed sample), messaging
add-on for the agency (channels of the agency tenant kept beside the owner world). `mocks/platform/growth.ts`:
fee accruals (one uninvoiced, invoiced ones on a seeded purchase invoice), dispute → credit note on that invoice
(state follows the note: requested → disputed, issued → credited, rejected → invoiced); admin media orders (schedule,
presign deliverable, deliver, cancel). Public listings: two verified-vacant samples, the API's JSON-LD and OG URL;
the search puts one boosted sample on top of page 1 with `sponsoredLabel`.

## Tests
Unit: status maps (boost, media service, fee accrual, social channel, social post — coverage test). e2e written, not
run (deferred, founder change 2026-10-28): `owner-growth.spec.ts` (Facebook Page connect refused / connected /
verify / revoke; listing post status + retry; share-kit photos; boost not on sale → priced → bought → pending →
paid → active; media order; building boost free; agency LINE OA add-on terms accepted), `admin-growth.spec.ts`
(fee dispute → credit note approved by a second user → credited; media order schedule → upload → deliver; cancel),
`marketing.spec.ts` additions (JSON-LD + og:image, verified-vacant badge, sponsored label). lint, typecheck, unit,
build, build-storybook, Lighthouse (owner `/promote`, `/settings/facebook-page`; admin `/subscriptions/fees`, `/listings/media`) if it runs here.
