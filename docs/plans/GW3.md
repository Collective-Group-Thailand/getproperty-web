# GW3 — Contract library & renewals (web, after api G3)

Pack: `docs/prompts/G-growth-web.md` GW3 · decisions D-290, D-294 (G3 rules, Proposed), D-020 / D-158 (forbidden
clauses; block in scope, warn outside), D-062 (e-signature evidence), D-219 · open O-025 / O-030 (legal review of
every draft; e-signature level, reservation-fee wording, per-clause references, mandate commission wording).

Contract: adopt api HEAD (G3) with `API_CONTRACT_REF=HEAD pnpm gen:api --adopt`; `apiCommit` = Mac `36c7c79eb15a`.
Mocks that the new required fields break (`LeaseDto.template.versionId`, `MandateDto` / `CoBrokeDto.contractDocumentId`)
are filled.

## Navigation
The API's owner menu has no contracts key: the lease section gets link tabs (`ContractsNav`) — leases · contract
library · contracts · renewals — on `/leases`, `/contracts`, `/contracts/documents`, `/renewals`. Contract request:
an owner menu key `contracts` (and an admin key for the legal-review list). Mandate rows (owner) and co-broke rows
(listing agency) link to "Write the contract" (`/contracts/documents?new=<kind>&…`); the lease page links an addendum.

## Screens (owner zone)
- **Library** `/contracts`: platform drafts and my templates, filters kind (select) and language (th / en tabs);
  each template shows kind, versions (language, version, state) and the **legal-review badge**
  (`pending_legal_verification` → "รอตรวจทางกฎหมาย", amber; `reviewed`); the **disclaimer** from the API (setting
  `contract.library.disclaimer`, in the UI locale) on top of the page. *Copy to my templates* (published version picked
  by language, optional name) → `POST /v1/owner/contract-templates` → the editor.
- **Editor** `/contracts/templates/{id}`: header (name, kind, version state + legal badge, base "copied from"),
  disclaimer always visible. Left: name + Handlebars text (textarea, monospace) with *Save draft* (`PATCH`; editing a
  published template opens its next draft — copy says so); `contract.template_invalid` / `contract.unknown_variable`
  shown with the API's field errors. Right: **variables panel** (the API's catalogue, click inserts `{{name}}` at the
  cursor, used ones marked) and the **clause list** (live outline parsed from the text being typed: each `<section>`
  by its `<h2>`, read-only text — never rendered as HTML). Below, three views: **Preview** (live outline with
  `{{variables}}` highlighted + the API's sample PDF of the saved draft), **Diff** (side-by-side per clause vs the
  base: unchanged / changed / added / removed, `GET …/diff`), **Compliance** (`POST …/actions/check`: in / out of
  the สคบ. scope, findings with severity *blocked* / *warning*, the clause, excerpt, source (protective wording
  removed / forbidden wording added) and the legal reference; problems and unknown variables). *Publish*
  (confirmation restating the version; 422 `compliance.forbidden_clause` shown with its legal reference; outside the
  scope the warnings stay visible after publishing). A platform draft opens read-only with *Copy*.
- **Contracts** `/contracts/documents` (+ `?new=<kind>`): signable documents (reservation, addendum, brokerage
  mandate, co-broke) with state / kind filter; *New contract* dialog: kind → its fields (reservation: unit, person,
  fee, rent, move-in, held until, refund terms; addendum: lease, effective date, 1–5 clauses; brokerage mandate:
  mandate, note; co-broke: agreement, note), template version (my published ones of the kind or the platform draft),
  language, title. Every value typed goes to `variables`; nothing is computed.
- **Contract** `/contracts/documents/{id}`: number, state, legal badge, disclaimer, pinned template (key v#), signers
  with signed time, the values typed, sha256; actions = `nextActions`: preview (draft PDF), send for signature
  (Idempotency-Key), **sign** (operator: the PDF read from `…/document` — its sha256 shown and sent as
  `contractSha256` — and a drawn signature; Idempotency-Key; 409 `contract.changed` explained), cancel (reason),
  download.
- **Renewals** `/renewals`: offers by state (open / decided), each with unit + lessee (from the leases list), current →
  offered rent, the suggestion and its **source** (benchmark k ≥ 5 / comparables / current rent), months, start,
  respond by, decline reason, the new lease link; *Withdraw* on open offers.
- **Lease page**: a *Renewal* card — offers of the lease with state; *Offer renewal* (when the lease's `nextActions`
  has `renew` and no offer is open): `GET …/renewal-suggestion` shows the suggested rent with its source and basis and
  the other candidates; rent (default the suggestion), months (default the term), message, letter language;
  Idempotency-Key; copy says the B7.5 letter goes out with it and the resident answers in LINE. *Add an addendum*
  link.

## Mocks
`mocks/owner/contracts.ts`, state `contracts` (reset part `contracts`): platform library (6 kinds × th / en + the
lease kinds), own templates per tenant, clause diff (same `<section>`/`<h2>` rule), text check (forbidden wording
"ค่าต่อสัญญา" / removed protective clause → block for the sample apartment tenant (in scope), warn for the landlord),
unknown variables refused, contracts with signers / send / sign (sha must match) / cancel, renewal suggestion
(benchmark for the sample tenant), offers (one open per lease, B7.5 letter added to the lease's notices), withdraw.

## Tests
Unit: clause outline + variable tokens (`clauses.test.ts`), status maps (coverage test). e2e
`owner-contracts.spec.ts`: library (disclaimer, legal badge, filters) → copy → editor: unknown variable refused,
edit → diff changed clause → check blocked with legal ref → publish refused → revert → publish; landlord (out of
scope) publishes with a warning; addendum created on a lease → sent → signed (sha256 + drawn signature, idempotent);
renewal offered from the lease with the benchmark suggestion → listed on `/renewals` → withdrawn; axe on each page;
390 px editor.
