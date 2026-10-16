# Prompt pack v1 — getproperty-web (frontend)

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
| F3.1–3.3 | `Then read docs/prompts/F3-tenant-liff.md. Do Deliverable 3.N only. Plan first.` | R1 |
| F4.1–4.3 | `Then read docs/prompts/F4-staff-pwa.md. Do Deliverable 4.N only. Plan first.` | R1 |
| F5.1–5.3 | `Then read docs/prompts/F5-admin.md. Do Deliverable 5.N only. Plan first.` | R1 |
| F3.4 | `Then read docs/prompts/F3-tenant-liff.md. Do Deliverable 3.4 only. Plan first.` | R2 |

ขนานได้: F2–F5 หลัง F1 ใน git worktree แยก (รันกับ MSW จนกว่า backend จะมี) · ต้อง `pnpm gen:api` ทุกครั้งที่ `getproperty-api` tag release ใหม่

## ก่อนเริ่ม F3 — ต้องมี LINE OA + LIFF app (channel ของ Collective Group) และ LIFF endpoint URL ชี้มาที่ `TENANT_HOST`

## หลังทุก session
ตรวจ `docs/PROGRESS.md` · endpoint ที่ขาดอยู่ใน `docs/contract-requests.md` → ส่งให้ `getproperty-api`
