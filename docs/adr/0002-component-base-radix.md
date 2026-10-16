# ADR-0002 — Component base: Radix primitives + Tailwind v4 + CVA, with a `<Field>` context

**Status:** Accepted (2026-10-16, F0 0.2) · Proposed 2026-10-16 (F0 0.1)

## Context
design-system.md §3 lists a component library "built on Radix primitives / shadcn patterns, fully typed,
themable, documented in Storybook with a11y tests", used unchanged by four zones with different density
(owner/admin console, tenant 16 px / 48 px targets, staff 18 px / 48 px targets, high contrast).

## Decision
- **Behaviour from Radix** (`radix-ui` single package): Dialog, AlertDialog, Popover, DropdownMenu,
  Tooltip, Tabs, ToggleGroup, Select, Checkbox, RadioGroup, Switch, Slot. Focus trapping, roving focus,
  typeahead, `aria-*` wiring and portals are never re-implemented per screen. Where Radix has no
  primitive (Combobox, DatePicker grid, OTPInput) the component follows the WAI-ARIA pattern directly and
  documents its keyboard map.
- **Looks from Tailwind v4 utilities over semantic tokens** (ADR-0003), composed with
  `class-variance-authority` (variants = the component tier of the tokens) and merged with
  `tailwind-merge` through `cn()`, so a caller can override without `!important`. A component never
  names a raw palette step; ESLint refuses `bg-teal-600` in `className`.
- **Forms through `<Field>`**: one context provides `id`, `aria-describedby` (error first, then hint),
  `aria-invalid`, `required`, `disabled` to whatever control sits inside (`useFieldProps`), or
  `aria-labelledby` to a composite (`useFieldGroupProps`: RadioCards, OTPInput, SegmentedControl). A11y
  wiring is structural, not something each screen remembers.
- **Copy as props.** Components take their labels (`skipLabel`, `closeLabel`, `digitLabel`…) from the
  caller, who resolves them through `src/i18n`; `react/jsx-no-literals` and an attribute rule enforce
  it in `src/ui` too, so every primitive stays usable in Storybook and in both languages.
- **Icons through a registry** (`ICONS`, Lucide): zones name a meaning (`"meter"`, `"bill"`), never a
  Lucide export; `src/domain/status` can therefore name an icon. Status is always icon + text.
- **Density by zone, not by prop.** `data-zone` on `<html>` and `data-size` on controls let
  `src/ui/styles/zones.css` raise the staff base size to 18 px and the tenant/staff control height to
  48 px without a second component set.
- **Server-safe barrels.** Interactive components carry `"use client"`; `AppShell`, `Card`, `Badge`,
  `Stat`, `Timeline`, `Callout`, `Empty/ErrorState`, `MoneyDisplay` stay server components, so a page
  is not a client tree by default.
- **Tests.** Every component has a story; `src/ui/test/stories.a11y.test.tsx` renders every story
  under jsdom and asserts zero axe violations in `pnpm test`; `src/ui/test/stories.test.ts` fails when
  a component has no story. Playwright + axe covers the shells.

shadcn's copy-into-repo approach was taken for the *patterns*, not its files: tokens, naming and the
Field context differ, and `src/ui` is the only place a primitive is styled.

## Consequences
- Money is display-only in `src/ui` (`MoneyDisplay`); the one place a person types an amount uses
  `NumberInput unit="บาท"` and the API validates the string. There is no `MoneyInput` to compute with.
- A new component = file + story + (optional) unit test; the axe gate is automatic.
- Zones never restyle a primitive locally (design-system.md §1.8); they extend `src/ui`.
