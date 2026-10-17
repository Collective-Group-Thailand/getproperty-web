# src/features/staff

Staff PWA features (F4). Zone-isolated (ESLint `getproperty/zone-boundaries`).

- `today/` — Today: readings before the cut-off (by floor), open inspections, devices to install (4.1).
- `readings/` — the reading round and the capture flow (camera → keypad → `POST /v1/staff/meter-readings`
  through the offline queue), `roundState.ts` merges the API's round with this device's queue (4.1).
- `inspections/` — checklist with an IndexedDB draft (`draft.ts`) synced with `If-Match`
  (`useInspectionDraft.ts`), multi-shot photos, move-in comparison, signatures (4.2).
- `devices/` — devices of a building, gateway provisioning by QR with the realtime network check, the
  meter binding wizard, meter swap, device detail with identify / read now and the LAN status page (4.3).
- `pwa/` — offline queue hooks (`useOfflineQueue`, `useQueueEntries`, `submitThroughQueue`), the sync
  centre, service worker registration, push prompt (F1 1.3, ADR-0007).
- `shared/` — staff scope (buildings, focus, rounds), building switcher, evidence thumbnails, the
  capture components' labels, unit helpers.
- `lock/`, `shell/` — device PIN and the shell (F1 1.3).

Capture, camera, keypad (on the checklist) and signature code loads on first use (`lazyWarm`): the staff
initial-JS budget is 200 KB (D-179).
