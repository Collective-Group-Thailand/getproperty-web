# JW1a — Juristic console: register, budgets and resolutions, rates, cycles, overview (plan + record)

> **Record (done 2026-11-05)**: as planned, plus the admin tenant record's Buildings section, the Lighthouse `juristic` set and the slip reasons of the adopted contract. See PROGRESS 2026-11-05 (JW1a) and "Design decisions (J)".

Step **JW1a** of `docs/prompts/J-juristic-web.md` § JW1 (pack J), split by the team lead: JW1a = everything juristic
**except** money collection screens; JW1b = receivables, collection cases, ladder editor, statements, letter batches,
payment plans, debt clearance, verify page, mandates, reports, D-270 screens. Branch `feat/JW1a-juristic-console` from
`main` `ec79af0`. Contract adopted at api `ed938f2` (J1.1a, J1.1b, JR, J1.2a, J1.2b merged):
`API_CONTRACT_REF=ed938f20c5da9f2acd5d9677f1f9655ecdd6e022 pnpm gen:api --adopt` → `contract.lock.json` `apiCommit`
`ed938f20c5da`. Design: `DESIGN.md`, `J-DESIGN.md` (design lead), the G0 shell (ConsoleRail) and shared pieces.

## What the API gives (read from the plans J1.1a–J1.2b and the contract)
- Register `/v1/owner/juristic/register*`: list (`buildingId`, `q`, `incomplete`), unit record (owners + shares,
  history, bill-to + history, transfers), PATCH plot fields / ratio (`version`), add co-owner (422
  `register.shares_exceeded`), whole-unit transfer (Idempotency-Key, result = transfer + register; the transfer names
  its credit notes and buyer charges by id), bill-to (consent document required) + end.
- Resident invite codes (JR): `POST|GET /v1/owner/units/{unitId}/resident-invites` (code + QR PNG shown once).
- Resolutions (draft → adopted → void, documents minutes / attachment / notice) and budgets (draft → approved →
  superseded; lines income / expense / fund; approve needs an adopted resolution), rate preview (min / median / max,
  Σ check, missing weights) and `create-rate-plan-draft` (→ `budget_split` version with the budget's resolution).
- Rate plans: `frequency`; bases `per_sqwa`, `budget_split` (`splitBy`); budget tier `period month | year`;
  `resolutionId` (422 `rate_plan.resolution_required` / `rate_plan.resolution_invalid`).
- Billing cycles: `frequency`, keys `YYYY-MM | YYYY-Qn | YYYY-Hn | YYYY`, list filter `frequency`.
- Onboarding: `PropertyDto.kind` (required for juristic), `BuildingDto.legalForm` (required for juristic), units
  `landAreaSqwa`, `plotNo`, type `plot`; admin `claim-stub` (`propertyKind`, `legalForm`) and `change-operator`
  (`legalForm`).
- Members: roles `committee`, `auditor` (`accessUntil` required for auditor, ≤ `juristic.auditor_max_days`).
- Reports used read-only on the overview: `reports/aging`, `reports/collection-rate`, payment-plan / debt-clearance /
  receivables counts (`meta.total`).
- Menu keys: `juristic_register`, `juristic_cycles`, `juristic_budgets` (+ JW1b's `juristic_receivables`,
  `juristic_statements`, `juristic_collection_ladder`, `juristic_payment_plans`, `juristic_debt_clearances`,
  landlord `juristic_workspace_invitations`).

## Routes (owner zone, juristic tenants)
| Route | What |
|---|---|
| `/juristic` | Overview ("เช้านี้" for juristic tenants): figures row (billed, collected %, outstanding highlighted, units in arrears, active plans), aging strip (4 tiles), this cycle's rail (open → computed → issued → collecting), tasks (budgets / resolutions waiting, debt clearance requests, disputes — counts; links only to pages that exist). |
| `/juristic/register` | Co-owner register: toolbar (building, search, incomplete filter); village / community = plot list grouped by soi with ตร.วา; condo = floor cards with ratio; select units → print resident invite QR sheet. |
| `/juristic/register/[unitId]` | Unit record: owners + shares bar, history, bill-to (+ form with consent upload via `files/presign`), contact channels, transfers, invite codes; panel: transfer, add owner, invite, edit plot fields. |
| `/juristic/register/[unitId]/transfer` | Whole-unit transfer wizard: date → buyers + shares → review (typed confirm) → result from the API (policy, credit notes, buyer charges). |
| `/juristic/register/invites` | Batch invite sheet: chosen units, "สร้างรหัสและพิมพ์" creates one code per current co-owner, printable A4 sheet (QR from the API). |
| `/juristic/resolutions`, `/juristic/resolutions/[id]` | List (state filter) + paper-like record: adopt, void (reason), attach minutes / attachments / notice, edit draft. |
| `/juristic/budgets`, `/juristic/budgets/new`, `/juristic/budgets/[id]` | List; numbered form (lines by kind); record: lines by account (kind until the J2.1 chart of accounts), linked resolution, approve (resolution picker), "สร้างอัตราจากงบนี้" with basis picker, live preview table (min / median / max) + "รวม = งบ ✓", create the rate-plan draft. |
| `/juristic/cycles` | The billing-cycle workspace with frequency filter and period keys in Thai (ไตรมาส 1/2570, ครึ่งปีแรก 2570, ปี 2570). |

Existing screens changed: rate plans (frequency, new bases, budget tier period, resolution picker), properties /
buildings / units (kind, legal form, plot fields, unit type `plot`), members (committee, auditor + access until),
billing workspace (frequency badge + filter, period formatting), admin tenant record (new "Buildings" section with
claim stub and change operator; onboarding offers `juristic`).

## Design decisions (also recorded in `docs/PROGRESS.md` → "Design decisions (J)")
See PROGRESS. Summary: J-DESIGN §5 navigation driven by the API's keys (JW1b keys mapped to nothing until their
pages exist — no dead ends); `dashboard` opens `/juristic` for juristic tenants; vocabulary per `property.kind` as
i18n data; a village's building is its soi; transfer as a full page wizard; money only from the API (budget form shows
counts, the API's total after save); error summary component for long forms.

## Mocks
`mocks/owner/juristic.ts`: a juristic tenant "นิติบุคคล เดอะ ริเวอร์ไซด์" (persona `juristic`, `0810000010`; and a
`committee` persona `0810000011`) with a condominium (condo_act, 2 floors × units with ratios, co-owners 60/40, an
incomplete unit, bill-to agency) and a housing estate (land_allocation_act, two soi with plots in ตร.วา). Stateful
handlers for every new endpoint; generic endpoints (properties, buildings, units, cycles, rate plans, members,
invitations, files) answer for the juristic tenant from this world and fall through otherwise.

## Tests
Vitest: vocabulary map (every kind has every word in th + en), period-key formatting (four frequencies, th / en),
rate preview display (min / median / max, Σ check states, missing weights), transfer wizard reducer, share validation
(4 dp, Σ ≤ 100, exactly 100 for a whole transfer), menu layout for juristic tenants. Playwright (written, not run —
founder deferral): `e2e/juristic-register.spec.ts` (register → unit → transfer), `e2e/juristic-budget.spec.ts`
(budget → approve → rate preview → draft). Storybook: ShareBar, AgingStrip, BasisPreview, ErrorSummary, InviteSheet,
PlotList / FloorCards.

## Gates
lint · format:check · typecheck · unit · `gen:api --check` · design-language / dead-ends · build · build-storybook ·
Lighthouse owner budget (system Chrome) · screenshots 1440 + 390 in `/home/claude/work/_shots/j-JW1a/`.
