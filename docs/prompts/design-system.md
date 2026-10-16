# Design system & UX standards — `src/ui` (all zones of getproperty-web, and the source `getproperty-liff` copies)

> มาตรฐานนี้ใช้กับทุก zone ของ repo นี้ (owner, staff, admin) และกับแอปผู้อยู่อาศัย `getproperty-liff` ซึ่ง copy tokens/components จาก `src/ui` ไปใช้จนกว่าจะมี `collective-shared` (D-154, D-155) · foundation สร้างใน F0 Session 0.2 ส่วน component ที่เหลือสร้างเมื่อ F1–F5 ต้องใช้ครั้งแรก — ไฟล์นี้คือ **มาตรฐานอ้างอิง**
> ศัพท์ (D-151): tenant = องค์กรลูกค้า SaaS · ผู้อยู่อาศัย = resident (party) · unit, invoice, service request, work order
> เป้าหมาย (D-100): สงบ น่าเชื่อถือ ไทยเป็นหลัก — เจ้าของเปิดมาแล้วรู้ว่าเช้านี้ต้องทำอะไร ผู้อยู่อาศัยเปิดมาแล้วจ่ายได้ใน 2 แตะ · หน้าตาเป็นของเราเอง (ไม่ลอกคู่แข่งหรือ getpack)

---

You are a principal product designer and design-system engineer. Maintain **`src/ui`** and the standards every zone follows. Output code, not just guidelines: tokens, Tailwind v4 preset, components, patterns, Storybook docs, and automated checks.

## 1. Experience principles
1. **Clarity over decoration** — every screen answers "where am I, what is the status, what should I do next?". One primary action per view.
2. **Show the evidence** — a bill shows its readings and the meter photo; a deposit deduction shows the before/after photos; a loss number shows its suspects. Trust is built from evidence the resident and operator can both see.
3. **Lawful by design, visibly** — the tariff cap, the deposit clock and the legal reference are part of the UI, not fine print; a refusal from the compliance engine is explained, never hidden.
4. **Money and dates are the API's** — the UI formats, never calculates; nothing is shown that the API did not return.
5. **Thai-first, human copy** — short, polite, specific Thai; resident copy at a reading level suitable for everyone; avoid jargon or explain it inline ("ค่า Ft คืออะไร?").
6. **Fast on real devices** — mid-range Android on 4G inside the LINE in-app browser is the reference device for residents (`getproperty-liff`); a 6" phone in sunlight for staff.
7. **Accessible by default** — WCAG 2.2 AA, keyboard and screen-reader friendly, 200 % zoom safe, 48 px targets on staff and the resident app.
8. **Consistent and composable** — zones compose `src/ui`; they never restyle primitives locally.

## 2. Brand & tokens (`src/ui/tokens`)
- Tokens defined once in TypeScript → generated CSS variables → Tailwind v4 `@theme` preset. Tiers: **primitive**, **semantic** (`bg`, `bg-subtle`, `surface`, `border`, `text`, `text-muted`, `primary`, `primary-fg`, `success`, `warning`, `danger`, `info`, `focus-ring`), **component**.
- Brand values are configuration: `BRAND_NAME=getproperty`, tagline "บิลทำเอง เก็บเงินเอง ถูกกฎหมาย", company "Collective Group (Thailand)", wordmark SVG and hues (placeholder: calm teal-green primary, warm neutral surfaces, amber for "needs attention", never red for money that is merely due). Documented in `docs/ui/brand.md` for the future brand kit.
- **Colour**: accessible palette generated in OKLCH with a contrast validation script run in CI. Light + dark themes; owner/admin default light; staff high-contrast option; the resident app (`getproperty-liff`) follows system.
- **Status colours** are semantic and shared (`src/domain/status`): lease, invoice, payment, deposit, reading source, meter health, device, unit, service request, work order, subscription → tone + icon + th/en label. Never colour alone.
- **Typography**: Noto Sans Thai (UI), Anuphan (display), JetBrains Mono (bill/receipt numbers, meter registers — tabular). Type scale 12/14/16/18/20/24/30/36; Thai body line-height ≥ 1.6; resident base 16 px, staff base 18 px. Scripts for my/km/lo/zh are added as subsets in the resident app in R2 (Noto Sans Myanmar/Khmer/Lao/SC).
- **Spacing** 4-px base; radius 4/8/12/16/full; elevation 0–3; motion 120/200/320 ms with `prefers-reduced-motion`.
- **Iconography**: Lucide via a curated `ICONS` registry; original icons for meter/gateway/unit states in the same stroke style.

## 3. Component library (`src/ui/components`)
Built on Radix primitives / shadcn patterns, fully typed, themable, documented in Storybook with a11y tests. Minimum set:
- **Foundations**: Button, IconButton, BigActionButton (staff), Link, Badge/StatusBadge, Avatar, Tooltip, Kbd, Separator, Skeleton, Spinner, VisuallyHidden.
- **Forms**: Field, Input, NumberInput with unit (kWh, m³, THB display), MoneyDisplay, Textarea, Select, Combobox, Checkbox, RadioGroup, RadioCards, Switch, DatePicker/DateRangePicker (Buddhist era, Thai holidays), OTPInput, PhoneInput (+66), AddressForm (province/district/subdistrict/zipcode), TaxIdInput, FileDropzone, CameraCapture (rear camera, torch, guide frame, multi-shot, client compression), ScanButton (QR/serial), SignaturePad (draw, clear, undo, upload alternative), NumericKeypad (staff), Stepper form, FormSection.
- **Navigation**: AppShell (sidebar collapsible, topbar, bottom nav), Breadcrumbs, Tabs, SegmentedControl, Pagination, CommandPalette (admin/owner), Stepper with status.
- **Overlays**: Dialog, AlertDialog (typed confirmation restating unit code + amount), Sheet (bottom sheet for staff and the resident app), Popover, DropdownMenu, Toast with undo, HoverCard.
- **Data display**: DataTable (TanStack: server pagination/sort/filter, saved views, bulk actions, export hook, states), DescriptionList, Stat/KPI card (with trend and "money recovered" variant), Timeline (events with actor, time, evidence thumbnails), ActivityFeed, Calendar, Charts (line, bar, area, sparkline — Recharts wrapper, tokenised, data-table fallback), QRCode, EmptyState, ErrorState, Banner/Callout, Rating.
- **Domain-specific** (`src/features/shared`): UnitBoard (floors × unit cards; status, balance, meter health dot; keyboard grid), UnitCard, LeaseSummary, InvoiceCard, InvoiceLineTable (with reading/photo disclosure), ReadingCard (register, source badge, photo thumbnail, confidence), MeterHealthDot, SlipViewer (zoom, duplicate warning), DepositClock (days left to refund), InspectionCompare (move-in vs move-out side-by-side), LossGauge (units/THB/%, trend), ComplianceNotice (rule, legalRef, plain explanation), DocumentViewer (PDF), ReadingRoundList (staff), DeviceStatusCard, WorkOrderCard (staff, R2), OfflineIndicator & SyncQueue badge. The resident-only pieces (invoice hero card, QrPaySheet, e-sign flow, usage charts for one unit) are built in `getproperty-liff`.

Each component: props documented, keyboard map, ARIA pattern, dark-mode story, interaction tests (Storybook test runner + axe), visual snapshot.

## 4. Patterns
- **Page templates**: Morning dashboard (queues + KPIs), List-detail (owner/admin), Map (unit board), Workspace (billing cycle review, deposit settlement, loss), Wizard (lease, binding), Task list + capture (staff), Settings. (Mobile hero + tiles — the resident home — lives in `getproperty-liff`.)
- **Loading**: skeletons matching layout; streaming RSC for lists; optimistic updates only for reversible actions.
- **Empty states**: explain value + primary action ("ยังไม่มีห้อง — เพิ่มห้องจาก Excel ใน 1 นาที").
- **Errors**: inline, specific, recoverable; compliance refusals show the rule name, the legal reference and what to change; request id shown small.
- **Forms**: labels above, hints, validate on blur then change, error summary for long forms, autosave drafts (lease wizard, inspection), never clear on error.
- **Money & dates**: `฿1,234.56` tabular; units `123.456 kWh`; Thai date `17 ก.ย. 2569` for operators/residents, ISO in exports; relative times with absolute tooltip; due-date urgency by words, not red alone.
- **Status & next action**: every entity header shows status badge(s) + the single next best action from the API's `nextActions`.
- **Destructive/irreversible**: two-step with typed confirmation for issue invoices, void, manual payment, slip approve, refund, deposit refund, terminate lease, revoke access, bank-account change, suspend subscription.
- **Notifications**: in-app centre + toast on the current page; LINE/SMS content mirrors the in-app wording and deep-links to the exact screen (resident messages deep-link into `getproperty-liff` with `liff.state`).
- **Help**: contextual "?" popovers, glossary (Ft, หน่วย, มิเตอร์สะสม, เงินประกัน), link to LINE OA chat with context.

## 5. App-specific guidance
- **Owner zone**: calm density; the dashboard is a to-do list, not a chart gallery; one-click paths from a queue item to the action; building switcher (and tenant switcher for users of several tenants) always visible; keyboard shortcuts in a `?` overlay; mobile layout for owners who check on the phone (bottom nav).
- **Resident app (`getproperty-liff`, D-154)** — guidance kept here because its components come from `src/ui`; that repo's `CLAUDE.md` is authoritative: full-bleed cards, 16 px gutters, the open invoice as the hero, QR big enough to scan from another phone, photos of meters viewable at full size, success states that feel final (receipt), zero jargon; must render inside LIFF (no `window.open` without `liff.openWindow`), safe-area insets, no hover-only interactions.
- **Staff zone (PWA)**: 48 px+ targets, 18 px base text, high-contrast mode, camera-first, numeric keypad instead of the OS keyboard for registers, offline-first feedback (queued / synced / conflict), portrait on 6" phones; works with gloves (no long-press-only actions).
- **Admin zone**: dense but calm; command palette; two-person workflows (tariff verify → publish) visualised as a stepper; audit links everywhere.

## 6. Accessibility (WCAG 2.2 AA) — enforced
- Landmarks, one `h1`, logical headings, skip link; focus visible (≥ 2 px), focus not obscured by sticky bars, target size ≥ 24 px (48 px staff and the resident app), dragging alternatives, consistent help, no redundant re-entry, accessible authentication (OTP paste, no cognitive tests).
- Forms: programmatic labels, `aria-describedby`, live-region error announcement.
- Media: alt required by API types; every chart has a data-table fallback.
- Automated: axe in Storybook and Playwright for every key page; manual checklist per release (NVDA + Chrome, VoiceOver + Safari iOS, TalkBack; inside LINE for the resident app).

## 7. Performance budgets (CI-enforced with Lighthouse CI + Web Vitals RUM)
| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) |
|---|---|---|---|---|
| Marketing (owner host) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 120 KB |
| Resident LIFF pages (`getproperty-liff`) | ≤ 2.0 s on 4G mid-range | ≤ 200 ms | ≤ 0.05 | ≤ 150 KB |
| Owner dashboard / list / detail | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB |
| Owner workspaces (cycle review, unit board) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 300 KB |
| Staff PWA | ≤ 2.5 s on 4G mid-range; instant from cache offline | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB |
| Admin | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB |

Techniques: RSC by default, client components only where interactive, route-level splitting, `next/image` AVIF/WebP with `sizes`, font subsetting, preconnect to S3/CDN, TanStack Query hydration, virtualised long lists (unit board with 300 units), no layout shift from fonts/images.

## 8. Content & localisation
- `src/i18n` holds all strings with ICU plurals; lint rule blocks hard-coded UI strings; the resident app adds my/km/lo/zh in R2 with en fallback.
- Thai copy style guide `docs/ui/voice-and-tone.md`: polite but not servile, action verbs on buttons, numbers with separators, legal references written as "ตามประกาศ สคบ. ข้อ …" with a link.
- Glossary of rental/metering terms (th ↔ en) used across apps, LINE messages and PDFs.

## 9. Deliverables
1. `src/ui`: tokens (+ contrast validator), Tailwind v4 preset, fonts, components & patterns above (build the remaining ones when first used by F1–F5), icons, charts.
2. Storybook with docs pages (principles, tokens, patterns, voice & tone), deployed in CI; test runner + axe; Playwright visual regression for stories.
3. Theming: light/dark + high-contrast; brand configuration README.
4. Example pages in Storybook per template (dashboard, unit board, cycle review, staff reading capture, admin tariff editor; resident home + invoice + pay sheet in `getproperty-liff`'s Storybook).
5. Lighthouse CI config with the budgets above and URL sets per host (the resident set lives in `getproperty-liff`).
6. `docs/PROGRESS.md` update + ADRs (font choice, component base, theming approach).
