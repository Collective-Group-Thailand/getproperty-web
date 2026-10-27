# G — Listing & Growth (module E) · getproperty-web

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md`, `docs/prompts/G-growth-web.md` · ทำทีละ step ต่อ 1 session · เริ่มด้วย MSW ได้เมื่อ api commit contract ของ step ที่ต้องรอ · Plan Mode ทุกครั้ง

---

You are a senior frontend engineer on **`getproperty-web`** (owner console, staff PWA, platform admin, public marketing zone). Founder decisions in `getproperty-api/docs/prompts/G-README.md` are requirements. Build on B7 screens (listings, interested parties, verification badges, rent-record check, guides) — extend, never duplicate. Budgets (owner/admin ≤ 260 KB, staff ≤ 200 KB, marketing ≤ 180 KB), axe clean, th/en, logo/tokens per D-232.

## GW1 — Storage (after api G1)
Owner: storage meter (used / quota, breakdown by category, legal-hold share explained), largest files with bulk delete/restore (legal-hold rows locked with reason), 80/100 % banners, buy storage package (from admin-defined list; shows "ยังไม่เปิดขาย" when no package is active). Admin: package definitions editor (size, price, period, active window), per-tenant quota override with audit note, usage report.

## GW2 — Agency workspace (after api G2)
Tenant type `agency` onboarding; mandates inbox (invite/accept/revoke, exclusive), granted-units portfolio, co-broke agreements, deals list with recorded commissions (money outside platform — copy says so); owner side: invite an agency to a unit, see active mandates, revoke with typed confirmation.

## GW3 — Contract library (after api G3)
Library browser by kind/language with legal-review badge; copy to my templates; editor with clause list, variables panel, live preview, side-by-side diff vs base; compliance panel (blocked vs warning with legal reason); renewal workflow screens (offer, suggested rent with benchmark source, status); disclaimer always visible.

## GW4 — Distribution & growth billing (after api G4, G5)
Listing page additions: verified-vacant badge, real average utility cost, share kit (copy text, download images, open saved group links), Facebook Page connect + post log, agency LINE OA connect wizard; boost purchase and active boosts; public zone: listing pages with JSON-LD + OG, "โฆษณา" label on boosted results, search by area/budget.

## GW5 — Sponsored broadcast (after api G6)
Campaign builder for buyers: pick listings, segment by area/budget/type/move-in, recipient estimate (aggregate only), price preview from price plan, schedule; reports (aggregates only). Admin: global switch `broadcast.sponsored.enabled`, frequency cap settings, consent texts.

## GW6 — Self-viewing, employer housing, reviews, energy (after api G7–G9)
Owner/agency: viewing slots calendar (accompanied/self), entry log, incident to work order; employer housing: employer statements and payroll CSV; reviews with owner reply; energy insight card with getenergy opt-in.

After each step: PROGRESS, contract adopted (`API_CONTRACT_REF=<sha> pnpm gen:api --adopt`), e2e + axe + visual, Lighthouse for touched sets, commit.
