# Contract requests — getproperty-web

Endpoints or contract changes this frontend needs that the backend contract does not yet publish
(contract §1). Mocks of missing endpoints are marked `// CONTRACT-REQUEST` in `mocks/handlers/`.
Pinned contract: see `contract.lock.json`.

| Date | Method | Path | Purpose | Fields | Status |
|---|---|---|---|---|---|
| 2026-10-17 | — | `OperatorMeDto.menu`, `AdminMeDto.menu` | Menu entitlements are `string[]`; publish the keys as named enums (`OwnerMenuKey`, `StaffMenuKey`, `AdminMenuKey`) so a new key fails the web build until it has a route, label and icon (the web maps the keys of the API's `src/core/rbac/menu.ts` by hand and ignores unknown ones, F1 1.3). | enum components referenced by `menu.items` | open |
| 2026-10-17 | — | `InvitationCreatedDto.inviteUrl` | Invitations of the Staff role should link to the staff host (`STAFF_HOST/join?code=`), the others to the owner host; today every link uses `PUBLIC_WEB_APP_URL`. The web app serves `/join?code=` on the owner host meanwhile. | per-role base URL (`PUBLIC_STAFF_APP_URL`) | open |
