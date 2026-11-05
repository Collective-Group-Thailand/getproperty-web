# JW1b — Juristic console: money collection (plan + record)

> **Record (done 2026-11-05)**: as planned. See PROGRESS 2026-11-05 (JW1b) and "Design decisions (J)".

Step **JW1b** of `docs/prompts/J-juristic-web.md` § JW1 (pack J), the half JW1a left out: receivables, collection
cases, the ladder editor, statements and letter batches, payment plans, debt clearance with the public verify page,
payment mandates, the manual payment rules of juristic tenants, the collection reports, budget vs actual (income), the
D-270 juristic workspace and the juristic payment settings. Branch `feat/JW1b-juristic-collections` from `main`
`684d12d` (JW1a merged). Contract unchanged: api `ed938f2` (J1.2a + J1.2b merged, `gen:api --check` green).
Design: `DESIGN.md`, `J-DESIGN.md` §3 (receivables reference) and §4 (aging strip, collection timeline, ladder editor,
paper statement), Stitch `receivables-desktop.png`, the JW1a screens for consistency.

## What the API gives (J1.2a / J1.2b plans and the contract at ed938f2)
- **Receivables** `GET /v1/owner/juristic/receivables` (tab `all · at_step · plan · dispute`, `q`, sort `amount · age`,
  order, `buildingId`, page) → rows (unit, owner + context `{ownsUnits, nonResident, agent}`, outstanding, surcharge,
  oldest overdue date / months, next step `{kind, date, legalReviewRequired, awaitingApproval}`, channels, case /
  plan / dispute) and `totals`; `POST …/receivables/exports` → export job `juristic_receivables_csv` (worker).
- **Cases** `GET …/collection-cases[/{id}]` (timeline of `opened · step · paused · resumed · dispute_opened ·
  dispute_closed · resolved`, outcome `sent · skipped · awaiting_approval · approved · refused · failed`, next step);
  `approve-step`, `refuse-step` (reason), `open-dispute`, `close-dispute` (reason) with Idempotency-Key; 409
  `collections.invalid_state` / `collections.no_pending_approval`.
- **Ladder** `GET …/collection-ladders` (one per legal form; steps with offset, action, channels, templateKey,
  requiresApproval, enabled, `legalReviewRequired`, `gateClosedReason`), `PATCH …/steps/{id}` → 422
  `collections.legal_review_required` (params `reason`) and `collections.approval_required`.
- **Statements** list / get / document / issue a month (Idempotency-Key, `issued` + `skipped`) / pay (manual: method,
  amount, paidAt, evidence + note ≥ 5 for juristic; 409 `statement.nothing_due`, 422 `payment.partial_not_allowed`) →
  one payment per unit. **Letter batches** list / create `{period}` (202, worker) / get / document (409
  `statement.document_pending`).
- **Payment plans** list / get / propose `{partyId, unitId, instalments, firstDueOn?, note?}` (409
  `payment_plan.open_exists` / `nothing_due`) / approve (committee too) / reject / cancel (reason).
- **Debt clearance** list / get / create `{partyId, unitId, asOf?}` (409 `debt_clearance.outstanding` +
  `outstanding`) / issue / refuse (reason) / document; `verifyCode` returned **once**; public
  `GET /v1/public/documents/verify/{code}` (type, number, status, issued, asOf, validUntil, issuer, unit, initials).
- **Mandates** `GET /v1/owner/payment-mandates`, revoke (reason). **Payments**: allocations carry `surchargeAmount`.
- **Reports** `reports/aging`, `reports/collection-rate`; budget `actual-income`.
- **D-270**: landlord `GET|POST /v1/owner/juristic-workspace-invitations`, revoke (code shown once); public
  `GET /v1/public/juristic-workspaces/{code}`, `POST …/otp`, `POST …/accept` (operator tokens); workspace
  `GET /v1/owner/juristic/workspace/units`, `…/invoices`, `POST …/units/{id}/invoices` (bill the landlord).
- **Settings** `GET|PUT /v1/owner/settings/{key}`: `payments.allocation_policy`, `payments.allow_partial`,
  `payments.slip_max_age_days`, `juristic.plan_default_days`, `juristic.plan_max_instalments`,
  `juristic.debt_clearance.fee`, `juristic.debt_clearance.validity_days`.
- Menu keys `juristic_receivables`, `juristic_statements`, `juristic_collection_ladder`, `juristic_payment_plans`,
  `juristic_debt_clearances`, landlord `juristic_workspace_invitations`.

## Routes
| Route | What |
|---|---|
| `/juristic/receivables` | Figures row (outstanding highlighted, surcharge, accounts, plans, disputes), aging strip, underline tabs with counts (all · at step · plan · dispute), search + sort, table (pinned mono unit link, owner + muted context line, outstanding / surcharge right, oldest overdue, next-step badge with icon, channel icons), selection + white bulk bar on the pale tint (remind, propose plan, pause / dispute), CSV export via the worker, pagination; phones: one card per row. |
| `/juristic/receivables/[caseId]` | Case record: facts, collection timeline (next step pinned on the pale tint, events grouped by month), open / close dispute, approve / refuse a waiting step, links to statements and the plan; actions panel. |
| `/juristic/collections/settings` | Ladder editor per legal form: vertical steps (+N วัน, action, channels, template preview, approval, enabled); legal steps locked with "ต้องให้ทนายยืนยันก่อนเปิดใช้" and the API's `gateClosedReason`; the two 422s as designed states. |
| `/juristic/collections/payments` | Juristic payment settings from the API (allocation, partial payments, slip age, plan default days, max instalments, debt clearance fee and validity) — the generic setting rows. |
| `/juristic/statements`, `/juristic/statements/[id]` | Issue a month, list (month filter, search), paper record grouped by unit with the open invoices, PDF, record a payment over the statement's invoices (evidence + note). |
| `/juristic/statements/letters`, `/juristic/statements/letters/[id]` | Letter batches (create for a month, state, PDF for printing, the statements inside). |
| `/juristic/plans`, `/juristic/plans/[planId]` | Payment plans by state, propose; record with the instalment table; approve / reject / cancel. |
| `/juristic/debt-clearance`, `/juristic/debt-clearance/[id]` | Requests queue + certificates; new (unit + co-owner + as of; 409 outstanding with the amount); record (paper certificate), issue / refuse, PDF, verify code shown once with copy. |
| `/verify/[code]` (public) | Document check: type, status, validity, issuer, unit number, holder initials — nothing else; unknown code → designed not-found. |
| `/juristic/payment-mandates` | Auto-pay mandates (masked account / card) with revoke. |
| `/juristic/reports` | Aging (overall + per building) and the collection-rate KPI by cycle. |
| `/juristic/workspace` | D-270 workspace: linked units with their landlord, the workspace's invoices, "bill the landlord" form. |
| `/juristic-office` (landlord) | Invite the condo's juristic office (stub building + units, code shown once), list, revoke. |
| `/juristic/join/[code]` (public, auth chrome) | The office accepts: preview → name + phone → SMS code → workspace. |

Changed: budget record (budget vs actual income card), payment record (surcharge part per allocation), manual
payment form (juristic: evidence + note ≥ 5 chars), overview tasks (links now that pages exist), the rail.

## Rail fix (design review of JW1a)
The API (`src/core/rbac/menu.ts` at ed938f2) grants `parties`, `leases`, `deposits`, `readings`, `devices`,
`utility_loss` to juristic tenants (no tenant-type filter, the owner role holds the permissions). The web hides
nothing the API grants: for a juristic tenant those entries go to the end of the daily group in a quiet order, and
`parties` is named for the office ("บุคคลและบริษัท" instead of "ผู้เช่าและคู่สัญญา"). Contract request: juristic
tenant-type filter for the apartment-only keys.

## Tests
Vitest: receivables (sort / tab params, context line, next-step tone and icon, channels), aging tiles, ladder editor
state (offset between neighbours, channels, legal lock, approval lock, 422 mapping), timeline grouping + pinned next
step, statement grouping by unit, verify page minimality, manual payment validation, menu (juristic placement and
labels). MSW mocks for every endpoint (`mocks/owner/collections.ts`, public verify / workspace). Playwright written
(not run): receivables bulk remind, case dispute, ladder edit, statement pay, plan approve, debt clearance issue /
refuse + verify, D-270 invite / accept. Storybook: CollectionTimeline, LadderStep, BulkBar, NextStepBadge,
ChannelIcons, VerifyCard.

## Gates
lint · format:check · typecheck · unit · `gen:api --check` · icons / design-language / dead-ends · build ·
build-storybook · Lighthouse juristic set (extended) · screenshots 1440 + 390 in `/home/claude/work/_shots/j-JW1b/`.
