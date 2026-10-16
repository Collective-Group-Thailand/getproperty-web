# F5 — Platform admin zone

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/decisions.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F1 เสร็จแล้ว · ทำทีละ Deliverable (5.1 → 5.3) ต่อ 1 session

---

You are a senior frontend engineer on **`getproperty-web`**. Build the back-office for Collective Group staff (Platform admin, Support, Field engineer, Finance — D-090).

## Deliverable 5.1 — Orgs, subscriptions, support (B6.1, B6.4)
1. Org list/detail (health: subscription state, rooms counted, device fleet, last cycle state, compliance score, pilot KPIs), subscription management (plan, term, pilot terms, invoices, receipts, suspend/reinstate with typed confirmation), HaaS asset register per org.
2. **Support grants**: request, approve state, "view as org" read-only mode (banner, no mutation controls rendered; the API refuses anyway), audit trail of reads.
3. Tests: read-only mode renders no mutation; axe.

## Deliverable 5.2 — Tariffs, settings, privacy, audit (B1.3, B6.4)
1. **Tariff manager**: utility × region versions with structure editor (tiers, Ft, service charge, VAT handling), source document upload, effective date, two-person verify → publish workflow, diff view between versions, preview of a sample bill at the new tariff.
2. Platform settings (effective-dated), feature flags per org, notification templates (preview, test send), DSR console, audit log search, outbox/dead-letter replay.
3. Tests: tariff publish requires a second user (mock); axe.

## Deliverable 5.3 — Device fleet & OTA (B3.1)
1. Fleet map/list (online/offline/degraded per org/property), gateway detail (health history, config version vs applied, commands, logs upload), inventory import (CSV), assignment to orgs, OTA releases and ring rollouts with progress and rollback, certificate revoke/retire.
2. Tests: rollout progress rendering from SSE; axe.
