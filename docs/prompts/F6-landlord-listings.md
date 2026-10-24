# F6 — Landlord console, rental listings (public + owner), landlord documents, platform moderation

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `docs/prompts/design-system.md` ก่อน · ต้องมี contract จาก getproperty-api B7.N ที่ตรงกัน (`pnpm gen:api`) — ถ้ายังไม่มี ให้ทำกับ MSW mock ที่ติด `// CONTRACT-REQUEST` และจดใน `docs/contract-requests.md` · ทำทีละ Deliverable · Plan Mode ก่อน

---

You are a senior frontend engineer on **`getproperty-web`**. Decisions **D-250 – D-255** (Proposed, founder 2026-10-24) rule here with D-151 vocabulary (English copy and code: tenant = the SaaS customer; Thai copy may say ผู้เช่า, เจ้าของห้อง). The UI never computes money, fees, deadlines or legal values — it renders the API's. Every string through `src/i18n` (th, en). UI only from `src/ui`.

**Audience.** Owners of houses and condo units who rent them out themselves: not software users, mostly on a phone, often older. Design for one-thumb use, plain Thai, no jargon, ≤ 3 steps to any daily task. The public `/landlords` page (2026-10-24) is the promise this console must keep.

## Deliverable 6.1 — Sign-up and the portfolio console (D-251, api B7.1)
1. Public sign-up on the marketing host: `/landlords/start` → **phone, Google, Apple or LINE** (D-255, as getpack) → creates the landlord tenant → owner console. The owner sign-in page offers the same four. Every "เริ่มใช้ฟรี" CTA on `/landlords` points here when the flag `landlordSignup` is on (fallback: LINE OA).
2. First-run wizard (mobile-first): add your first unit (kind: คอนโด / บ้าน / ทาวน์โฮม / ห้อง → project search with stub creation for condos → size, bedrooms, rent) → "มีผู้เช่าอยู่แล้วไหม?" (yes → record the existing lease, rent, deposit; no → create a listing, 6.2). Done in ≤ 2 minutes on a phone.
3. Portfolio home (`/` for `tenantType = landlord`): one card per unit with state (ว่าง / ประกาศอยู่ / มีผู้เช่า / แจ้งย้ายออก), this month's bill status, lease end, open requests; totals expected / collected / overdue. Empty, loading and error states. The apartment menu stays for apartment tenants; landlord menu from `me`.
4. Acceptance: Playwright sign-up (mock LINE) → wizard → portfolio with one unit; axe clean; LCP ≤ 2.5 s on a mid-range phone profile.

## Deliverable 6.2 — Listing editor, leads inbox, viewings (D-252, api B7.2–7.4)
1. Listing editor: photos (drag to order, cover, client-side resize before upload, HEIC accepted), terms, description th/en with an optional "ช่วยเขียน" button (only if the API offers it), preview exactly as the public page, publish / pause / close. Pending-review and rejected states explained with the reason.
2. Owner verification flow: upload evidence, status, badge preview.
3. Viewing availability (weekly slots, exceptions).
4. Leads inbox: list by state, detail with the conversation (sent to the prospect in LINE by the API), confirm/decline viewing, mark viewed / applied / lost, **"สร้างสัญญาจากผู้สนใจรายนี้"** → lease draft (B7.4) → existing lease flow.
5. Acceptance: e2e create listing → publish → receive a lead (mock) → confirm viewing → create lease draft → listing shows closed after signing.

## Deliverable 6.3 — Public listing pages (D-252, api B7.3)
1. On the marketing host, indexable, server-rendered, th/en: `/rent` (search: area, BTS/MRT station, price, size, bedrooms, furnishing, pets; list + map; URL-driven filters), `/rent/[slug]` (gallery, terms, facilities, full address and map (D-252: nothing hidden), verified badge, similar listings, **"สอบถาม / นัดดูห้องทาง LINE"** → the LIFF prospect flow), area landing pages for SEO (e.g. `/rent/bts-on-nut`), `MARKETING_PATHS` → a sitemap generated from `GET /v1/public/listings/sitemap`.
2. JSON-LD per listing (`Accommodation` + `Offer`), canonical + hreflang, Open Graph image from the cover photo; owner contact goes through the LINE / sign-in flow so both sides keep the record.
3. Performance: marketing budget (design-system §performance) with images via the API's renditions, lazy map.
4. Report-this-listing link (to the LIFF/prospect flow or a simple form).
5. Acceptance: e2e search → detail → CTA; Lighthouse ≥ 95 SEO/Accessibility; sitemap lists published listings only.

## Deliverable 6.4 — Documents, notices and the annual tax summary (D-253, api B7.5)
1. Documents centre per unit and per tenant: every kind of D-253 with filters, preview, download, share to the resident's LINE.
2. Notice composer (rent increase, renewal offer, non-renewal, termination, late payment): the API returns the earliest lawful effective date; the UI only shows it.
3. Move-in / move-out inspection on the phone (photos per room/item, both signatures) and the deposit refund statement with itemised deductions and the deadline.
4. Annual income summary page with a clear "not a tax filing" note and PDF/Excel download.
5. Acceptance: golden screenshots th/en; each document kind reachable in ≤ 3 taps from the unit card.

## Deliverable 6.5 — Admin: moderation, verification, payment fee (D-250, D-252)
1. Admin queues: listings pending review / reported / auto-flagged (actions with reasons), owner verification (evidence viewer under audit, approve/reject).
2. Payment fee versions (maker-checker like tariffs) and payout accounts / KYC status per tenant (D-250, api B7.6); fee ledger and settlement discrepancies.
3. Acceptance: e2e moderation hide → restore; fee version publish needs a second admin.

## Deliverable 6.6 — LINE channel settings and message usage (D-254, api B7.7)
1. Settings › LINE: choose "ใช้ LINE OA ของ getproperty" (default, usage meter: this month, free allowance left, rate from the API) or "ใช้ LINE OA ของตัวเอง" — a guided connect wizard with screenshots of LINE Official Account Manager / LINE Developers (create Messaging API channel, copy channel id/secret/token, paste the webhook URL the API gives, turn off auto-reply/greeting conflicts), verify, rich-menu consent, status and health.
2. After connecting: "ชวนผู้เช่าย้ายมา LINE ของคุณ" (QR poster PDF + one-time broadcast from the shared OA) with a linked/unlinked residents count.
3. Admin: messaging rates versions (maker-checker), usage per tenant, failing channels.
4. Acceptance: e2e connect wizard against MSW (verify ok / bad token), usage meter, admin rate publish.

After each deliverable: `docs/PROGRESS.md`, `docs/contract-requests.md`, commit.
