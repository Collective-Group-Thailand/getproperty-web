# G-review — fixes for the independent review of GW1–GW6 (web)

Source: independent review of `6561a68..4a853ff` (3 medium, 10 low). Each finding re-verified in the code first, fixed,
and covered by a regression test that fails on `4a853ff` and passes after. No contract change (api `02ab053`).

| # | Finding | Fix | Regression test |
|---|---|---|---|
| M1 | OAuth sign-up ignored `next` | `complete()` signup branch returns the attempt's `next` (re-checked with `safeNextPath` / web-kit `safeReturnTo`) before the default page | `src/lib/auth/oauth/flow.test.ts`; e2e `owner-network` "a buyer signs up with LINE from the invitation…" |
| M2 | Dotted codes as next-intl keys show key paths | `src/i18n/keys.ts` `messageKey(code, prefix)`; message keys renamed (`assistant.problem.*`, base `arrears.setting.*`, admin `subscription.event.*`); messages test refuses any dotted key | `messages.test.ts` (no dotted keys), `ListingAssistant.test.tsx`; e2e `owner-insight` asserts the title |
| M3 | Renewal offer sendable without a rent the owner saw | `renewalOfferBody()` always sends a checked rent (prefilled visibly from the suggestion) and whole months 1–36; field errors via shared `invalidField` | `RenewalActions.test.tsx`; e2e `owner-contracts` blank rent refused |
| L1 | Stale drawn signature after reopening | `DialogSignaturePad` clears the parent's signature on mount / unmount and drops late PNGs (contract sign, lease countersign) | `DialogSignaturePad.test.tsx` |
| L2 | Energy opt-in stuck on `energy.consent_required` | untick, renew key, `router.refresh()`, "text changed, read again" callout | `EnergyOptIn.test.tsx` |
| L3 | VAT via `Number*100` | `vatPercent()` = `formatPercent(ratePercent())`; `ratePercent` accepts any decimals | `sponsored.test.ts` |
| L4 | `/handoff/<token>` in Sentry | `scrubUrl` masks the path segment; `scrubEvent` scrubs `transaction` and breadcrumb `from` / `to` | `scrub.test.ts` |
| L5 | Buttons active after "Not now" | `DeclineHandoff` refreshes the page after the answer | e2e `owner-network` decline |
| L6 | "60 and 30 days" hard-coded | `renewalReminder()` from `lease.renewal.remind_days` in `GET /v1/owner/settings`: days / off / nothing about days | `reminders.test.ts` |
| L7 | Invented default reach | `initialReach()` = the API's `minimumRecipients` | `broadcast.test.ts`; e2e `owner-broadcast` |
| L8 | Duplicate `id="reviews"` | heading id `reviews-title` | e2e `owner-insight` (single id, region name) |
| L9 | Tokens offered to password managers | `SECRET_FIELD_PROPS` (new-password, 1Password / LastPass / Bitwarden opt-outs) on Facebook token and LINE OA secret / token | `secret-field.test.tsx` |
| L10 | Key renewed only on success | `SubmissionKey` / `useSubmissionKey`: same body keeps the key, changed body renews it, success renews (campaign builder, AI assistant, handoff claim) | `submission-key.test.ts`, `ListingAssistant.test.tsx` |

Gates: lint, format:check, typecheck, unit, gen:api --check, build-storybook, targeted e2e (incl. build).
