# F3 — Tenant zone: LINE Mini App (LIFF) + mobile web

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว · ทำทีละ Deliverable (3.1 → 3.4) ต่อ 1 session
> หลักออกแบบ: "บิลที่จ่ายแล้วสบายใจ" — เห็นยอด เห็นหน่วย เห็นรูปมิเตอร์ สแกนจ่ายได้ใน 2 แตะ · ทดสอบใน LIFF จริงบน iOS/Android และใน browser ปกติ

---

You are a senior frontend engineer on **`getproperty-web`**. Build the tenant experience (D-060–D-064). Every page must work inside LIFF (LINE in-app browser) and as a standalone mobile web page (magic link).

## Deliverable 3.1 — Onboarding, home, lease (B2.2, B2.3)
1. LIFF entry (`/tenant/liff`): init, login, invitation code from the deep link (`liff.state`), consent screen (purposes from the API, versioned, D-025), accept invitation → home. Mobile-web fallback: magic link page, phone OTP.
2. **Home**: room card (building, room code, lease term), the open bill as the hero card (amount, due date, "scan to pay" CTA), quick tiles (usage, receipts, lease, repairs (R2), announcements), notification list; multi-room switcher.
3. Lease: contract viewer (signed PDF), **e-signature flow** for a pending lease (read contract → scroll-to-end gate → draw signature on canvas with clear/undo → phone OTP → signed confirmation with hash), building rules acknowledgement, 30-day **move-out notice** form (date picker with the earliest allowed date from the API, confirmation, notice document), deposit status & settlement response (accept / dispute with comment and photos).
4. Tests: Playwright with a mocked `liff` global (init, getIDToken, state) and the plain web path; signature canvas keyboard alternative (upload image) for a11y; axe.

## Deliverable 3.2 — Bills, pay, receipts (B4.2–B4.4)
1. Bill list (open first, then history by period) and **bill detail**: lines with previous/current readings, source badge, **meter photo** when it exists, units × price per unit (D-022), total, due date, late state; "bill explained" section with plain-Thai copy from i18n (why the amount, what the tariff is, with the legal reference link).
2. **Pay sheet**: Thai QR image (from the API) with amount and reference, "save QR" / "open banking app" helpers where the LINE environment allows (`liff.openWindow`), countdown of QR validity, auto-refresh of status via SSE → paid animation → receipt link. Slip upload fallback (camera/gallery → presign → submit → verification status; duplicate/mismatch messages).
3. Receipts list + PDF viewer + share to LINE chat (`liff.shareTargetPicker` when available).
4. Tests: payment state transitions on mocks + SSE; slip upload path; axe; Lighthouse tenant budget (LCP ≤ 2.0 s on 4G mid-range).

## Deliverable 3.3 — Usage, profile, privacy (B3.2, B1.3)
1. **Usage**: daily/weekly electric and water usage charts from the series endpoint (buckets), comparison with the previous period, "estimated so far this cycle" note only when the API provides it, tips content; works only when IoT exists (empty state otherwise explains the manual reading).
2. Profile: name, phone, language (th/en now; my/km/lo/zh in R2), notification preferences, linked LINE account, documents on file (view only), consent management, DSR request entry.
3. Tests: chart a11y fallback table; language switch persists via the API; axe.

## Deliverable 3.4 — R2: repairs, announcements, parcels, access (B5)
1. Repairs: create with photos and category, status timeline, chat-like updates, rating on close.
2. Announcements with read receipts; parcels with pick-up confirmation PIN; building contacts.
3. Access (where locks exist): own credentials, unlock log for own room, visitor code request (if owner allows).
4. Languages my/km/lo/zh activated for the tenant zone (messages from `src/i18n`, machine-translated base reviewed).
5. Tests: flows on mocks; axe; language rendering in all 6 locales (font coverage check for Khmer/Myanmar scripts — add subsets to `src/ui/fonts`).
