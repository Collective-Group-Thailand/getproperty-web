# src/i18n

- `routing.ts` — next-intl routing for the owner zone (`th` at root, `/en`); `gp_locale` cookie for the
  other zones.
- `request.ts` — next-intl request config: locale + zone → messages, `Asia/Bangkok`.
- `messages/<locale>/{shared,owner,staff,admin}.json` — copy per zone. Thai is written first and
  reviewed against `docs/ui/voice-and-tone.md`; English follows. The resident languages (my/km/lo/zh)
  live with the resident app in `getproperty-liff` (D-154); `format.ts` is copied there too.
- `format.ts` — `formatTHB`, `formatUnits`, `formatDate` (Buddhist era), `formatRelativeTime`… All take
  the API's decimal strings and ISO dates and never do arithmetic (CLAUDE.md).
