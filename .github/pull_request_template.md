## What and why

<!-- The deliverable (e.g. F2 2.1), the decisions it implements (D-###), and what changed for whom. -->

## Design QA (design-system.md)

- [ ] One primary action per view; secondary actions look secondary.
- [ ] Every state is designed: loading (skeleton shaped like the content), empty (with its next action), error (with a way on), offline where relevant.
- [ ] Tokens only — no raw palette steps, no hard-coded colours, spacing or durations; motion respects `prefers-reduced-motion`.
- [ ] Thai copy reviewed against `docs/ui/voice-and-tone.md`; every string in `th` and `en`.
- [ ] Status via `src/domain/status` (icon + text, never colour alone); compliance refusals show their `legalRef`.
- [ ] Accessibility: keyboard path works, focus visible, axe clean in `pnpm test` and `pnpm e2e`, names on icon-only controls, 48 px targets on staff.
- [ ] Money and dates come from the API (`formatTHB`, `formatUnits`, Bangkok time, Buddhist era); no arithmetic on money.
- [ ] Irreversible actions use `<AlertDialog confirmationPhrase>` restating room code + amount.

## Checks

- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm e2e` · `pnpm build-storybook`
- [ ] `docs/PROGRESS.md` updated; any missing endpoint in `docs/contract-requests.md` with a `// CONTRACT-REQUEST` mock
