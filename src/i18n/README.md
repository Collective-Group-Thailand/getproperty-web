# src/i18n

- `routing.ts` — next-intl routing for the owner zone (`th` at root, `/en`); `gp_locale` cookie for the
  other zones.
- `request.ts` — next-intl request config: locale + zone → messages, `Asia/Bangkok`.
- `messages/<locale>/{shared,owner,tenant,staff,admin}.json` — copy per zone. Thai is written first and
  reviewed against `docs/ui/voice-and-tone.md`; English follows. R2 adds my/km/lo/zh for the tenant zone.
- `format.ts` — `formatTHB`, `formatUnits`, `formatDate` (Buddhist era), `formatRelativeTime`… All take
  the API's decimal strings and ISO dates and never do arithmetic (CLAUDE.md).
