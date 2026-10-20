# Prompt pack v1 — getproperty-web (frontend: owner · staff · admin)

**getproperty — บิลทำเอง เก็บเงินเอง ถูกกฎหมาย** · Collective Group (Thailand)

## ลำดับการรัน และข้อความ kickoff (Plan Mode ทีละ session แล้ว `/clear` ก่อน session ถัดไป)
คำนำหน้ามาตรฐาน: `Read CLAUDE.md, docs/prompts/00-master-plan.md, docs/decisions.md, docs/contract/api-conventions.md and docs/prompts/design-system.md.`
ถ้า clone `getpack-web` ไว้ข้าง ๆ (`../getpack-web`) ให้เติม: `Use ../getpack-web as a conventions reference only (D-003); never copy its brand tokens or packaging screens.`

| Step | Kickoff (ต่อท้ายคำนำหน้ามาตรฐาน) | Release |
|---|---|---|
| F0.1 | `Then read docs/prompts/F0-setup.md. Do Session 0.1 only. Plan first.` | R1 |
| F0.2 | `Then read docs/prompts/F0-setup.md. Do Session 0.2 only. Plan first.` | R1 |
| F1.1–1.3 | `Then read docs/prompts/F1-foundation.md. Do Deliverable 1.N only. Plan first.` | R1 |
| F2.1–2.6 | `Then read docs/prompts/F2-owner-console.md. Do Deliverable 2.N only. Plan first.` | R1 |
| F2.7 | `Then read docs/prompts/F2-owner-console.md. Do Deliverable 2.7 only. Plan first.` | R2 |
| F4.1–4.3 | `Then read docs/prompts/F4-staff-pwa.md. Do Deliverable 4.N only. Plan first.` | R1 |
| F4.4 | `Then read docs/prompts/F4-staff-pwa.md. Do Deliverable 4.4 only. Plan first.` | R2 |
| F5.1–5.3 | `Then read docs/prompts/F5-admin.md. Do Deliverable 5.N only. Plan first.` | R1 |

ขนานได้: F2, F4, F5 หลัง F1 ใน git worktree แยก (รันกับ MSW จนกว่า backend จะมี) · ต้อง `pnpm gen:api` ทุกครั้งที่ `getproperty-api` tag release ใหม่

## F3 ย้ายไปแล้ว (D-154)
`F3-tenant-liff.md` (tenant zone: LINE Mini App + mobile web) **ถูกย้ายออกจาก repo นี้** ไปเป็น repo ใหม่ **`getproperty-liff`** — เนื้อหาถูกแตกและปรับศัพท์ตาม D-151 (resident, unit, invoice, service request, work order) เป็น `docs/prompts/L1-foundation.md` … `L4-r2-service-requests-community-technician.md` ที่นั่น · เลข F ที่เหลือ **ไม่ renumber** (F3 ว่างไว้) · LINE OA + LIFF app (channel ของ Collective Group) และ LIFF endpoint URL ชี้ไปที่ host ของ `getproperty-liff` ไม่ใช่ repo นี้

## หลังทุก session
ตรวจ `docs/PROGRESS.md` · endpoint ที่ขาดอยู่ใน `docs/contract-requests.md` → ส่งให้ `getproperty-api`
