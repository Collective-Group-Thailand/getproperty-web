# getproperty: Master checklist (อัปเดต 26 ต.ค. 2026 04:00)

สัญลักษณ์: ✅ เสร็จและ commit แล้ว · 🟡 เสร็จบน cloud รอ commit · 🔄 กำลังทำ · ⬜ ยังไม่เริ่ม · ⛔ รออย่างอื่นก่อน (บอกไว้ว่ารออะไร)

**ทำที่ไหน**
- **Cloud (Cowork นี้)**: getproperty-web, ส่วนหน้าเว็บและ UI ทั้งหมด ทดสอบด้วย mock API + Playwright แล้ว patch ลง Mac แล้ว commit
- **Mac (Claude Code)**: getproperty-api และ getproperty-liff ที่ต้องใช้ Node 24 + Postgres โดยใช้ prompt ที่ผมเตรียมไว้ใน `docs/prompts/` ของแต่ละ repo
- **คุณ**: ข้อมูลธุรกิจ บัญชีต่าง ๆ และการตัดสินใจที่ระบบตัดสินแทนไม่ได้

---

## 1. Brand, design system, typography (web: `src/ui`)
- ✅ ฟอนต์เดียวทั้งระบบเหมือน getpack: Anuphan (ตัวเลข/โค้ดใช้ JetBrains Mono) ลบ Noto/Trirong แล้ว
- ✅ ขนาดตัวอักษรปรับที่เดียว: `src/ui/tokens/scale.ts` (FONT_SIZE marketing, CONSOLE_FONT_SIZE owner/admin, staff ใน zones.css) แล้วรัน `pnpm tokens`
- ✅ มี test กันไม่ให้ใช้ฟอนต์อื่น ขนาด px ลอย ๆ gradient หรือ radius มั่ว (`design-language.test.ts`)
- ✅ Tagline ใหม่ "ให้เช่าง่าย อยู่สบาย" ใน README/CLAUDE.md/brand config/OG image ทั้ง 3 repo
- ⬜ ตรวจ Storybook ทุก component กับฟอนต์และขนาดใหม่ (ภาพหน้าจอเทียบก่อน-หลัง)

## 2. เว็บสาธารณะ (web: `src/app/[locale]/(marketing)`)
- ✅ หน้าแรก: hero, ก่อน/หลัง, 4 ขั้น, ฟีเจอร์, แจ้งซ่อม LINE, กลุ่มลูกค้า, ตารางเทียบ, ทีเซอร์ประกาศเช่า, FAQ, CTA
- ✅ /landlords สำหรับเจ้าของบ้าน/คอนโด
- ✅ /pricing ใช้ฟรี + ค่าธรรมเนียมต่อรายการ, verify slip, LINE OA 2 แบบ, add-on ดึงจาก API
- ✅ ตัดการขายเรื่องเพดานค่าไฟ สคบ. ออก (D-262)
- ✅ Navbar ใหม่ (เมนูกลาง, เส้นใต้หน้าปัจจุบัน, ปุ่ม "เริ่มใช้ฟรี"/"ลงประกาศฟรี" ตามหน้า, เมนูมือถือ)
- ✅ /rent หน้าค้นหาห้องเช่า: ค้นตามย่าน/ประเภท/ราคา/ห้องนอน/สัตว์เลี้ยง/เรียงลำดับ, ตัวกรองอยู่ใน URL
- ✅ /rent/[slug] หน้ารายละเอียด: แกลเลอรี, ข้อมูลห้อง, ที่อยู่เต็ม + Google Maps, ติดต่อเจ้าของทาง LINE, badge ยืนยันเจ้าของ, รายงานประกาศ, ห้องคล้ายกัน
- ✅ เอาป้าย "เร็ว ๆ นี้" ออกจากทุกหน้า
- 🔄 ขัดเกลาดีไซน์จากภาพหน้าจอ 1440/390 ทุกหน้า (แผงค้นหา, แกลเลอรี, ระยะห่าง)
- ⬜ เทียบกับ canvas "getproperty Website Redesign" ทีละ section แล้วแก้จุดที่ยังห่าง
- ⬜ หน้าภาษาอังกฤษ: ตรวจทุกหน้าว่าโครงตรงกับภาษาไทยและคำแปลเป็นธรรมชาติ
- ⬜ หน้า /rent ฝั่งผู้เช่า: บันทึกห้องที่ชอบ, แจ้งเตือนเมื่อมีห้องใหม่ตรงเงื่อนไข (ทาง LINE) ⛔ API B7.3
- ⬜ แบบฟอร์มรายงานประกาศ (scam) และหน้าเงื่อนไขการลงประกาศ ⛔ ร่างจาก O-018
- ✅ Guides ใช้โมเดลบทความกลาง `@collective/content` + รองรับลิงก์พันธมิตร (มีข้อความเปิดเผย, `rel=sponsored`) (D-277)
- ⬜ ใส่ลิงก์พันธมิตรจริงในคู่มือ ⛔ คุณ (ลิงก์โปรแกรม Shopee/Lazada)
- ⬜ Analytics events: cta_start, cta_list, cta_line, listing_view, listing_contact, search_used
- ⬜ Lighthouse ≥ 95 (Performance/Accessibility/SEO) ทุกหน้า, ไม่มี scroll แนวนอนที่ 360px

## 3. SEO / GEO / AEO (แบบ getpack)
- ✅ Meta title/description ไทย-อังกฤษ, canonical, hreflang, OG image ทุกหน้า
- ✅ JSON-LD: Organization, WebSite + SearchAction, SoftwareApplication (ราคา 0), FAQPage, BreadcrumbList, ItemList, Offer + Apartment/House ต่อประกาศ
- ✅ sitemap.xml รวม URL ประกาศทุกอัน (ดึงจาก API)
- ✅ robots.txt เปิด /rent, /rent/*, /landlords, /llms.txt
- ✅ /llms.txt สรุปเป็น markdown สำหรับ AI (ข้อเท็จจริง, หน้า, FAQ 3 ชุด, ประกาศล่าสุด)
- ✅ หน้าย่าน/สถานี /rent/area/[slug] + ลิงก์ย่านยอดนิยม (ใช้ mock จนกว่า API B7.9)
- ✅ คู่มือ 5 เรื่อง th/en (/guides) + เครื่องมือฟรี 3 ตัว (/tools)
- ✅ หน้าเกี่ยวกับเรา, ติดต่อ (ฟอร์ม), ความปลอดภัย/PDPA, ศูนย์ช่วยเหลือ, สำหรับผู้เช่าชาวต่างชาติ
- ⬜ ย้ายคู่มือเข้า CMS (API B7.13) และเพิ่มบทความต่อเนื่อง
- ⬜ ลงทะเบียน Google Search Console / Bing, ส่ง sitemap ⛔ คุณ (ต้องใช้บัญชีโดเมน)

## 4. Owner console (web: `src/app/[locale]/(console)`)
- ✅ หน้าเดิมทั้งหมด (dashboard, ตึก, ห้อง, มิเตอร์, บิล, ชำระเงิน, เงินประกัน, สัญญา, แจ้งซ่อม, ตม.30, รายงาน ฯลฯ) ใช้ฟอนต์/ขนาดใหม่แล้ว
- ✅ รีวิวดีไซน์ทุกหน้าด้วยภาพหน้าจอ (dev:mock): desktop + มือถือ 390px ครบ 26 หน้า แก้หน้าที่เลื่อนซ้ายขวาได้ 6 หน้า, การ์ดตัวเลข 2 คอลัมน์บนมือถือ
- ✅ การ์ดพื้นที่จัดเก็บในหน้าค่าบริการ getproperty (ใช้ไป/พื้นที่ฟรี, ไฟล์ vs ข้อมูล, ย้ำว่าไม่ลบ/ไม่ล็อกข้อมูล) (D-276)
- ⬜ เอาหน้า /subscription ออกหรือเปลี่ยนเป็น "ค่าธรรมเนียมรายเดือน" (ใบแจ้ง fee จาก verify slip) ⛔ API B7.2
- ✅ F6.1 สมัครเองสำหรับเจ้าของบ้าน/คอนโด (เบอร์โทร OTP) + หน้า portfolio + เพิ่มยูนิต (web fd76e99) — Google/Apple/LINE บนเว็บรอ B7.8
- ✅ F6.2 ✅ สร้าง/แก้ไขประกาศ (รูป ≥ 5, ราคา, เงื่อนไข, เวลานัดดู, ยืนยันเจ้าของ) web 4ba5e2a; ✅ กล่องคนสนใจ, นัดดูห้อง, ปฏิทินนัด web 9118bdb (api e742378)
- ✅ F6.4 เอกสารครบชุด: ✅ สัญญาเช่าตามประเภทยูนิต ไทย/อังกฤษ (เลือกภาษาในตัวช่วยสร้างสัญญา), อากรแสตมป์ (ยอด ผู้ชำระ กำหนดชำระ บันทึกการชำระพร้อมใบเสร็จ), หน้าเอกสารของแต่ละห้องจากพอร์ต (api 0565fa8); ✅ หนังสือแจ้งผู้เช่า 5 แบบ (ปรับค่าเช่า, เสนอต่อสัญญา, ไม่ต่อสัญญา, บอกเลิก, ค้างชำระ) ส่งจากหน้าสัญญา (api f640c27); ✅ หนังสือรับรองการชำระค่าเช่า (คำขอรออนุมัติ ออก/ปฏิเสธ หรือออกเองจากหน้าสัญญา), สรุปรายได้รายปีแยกค่าเช่ากับค่าบริการ + PDF, สัญญาสองภาษา (api 0e7ec3a)
- 🟡 F6.6 ✅ ตั้งค่า › LINE OA: เชื่อม OA ของตัวเอง (ทั้งองค์กรหรือรายตึก), Webhook URL + ปุ่มคัดลอก, ตรวจสอบอีกครั้ง, ยกเลิกการเชื่อม, วิธีเชื่อม (web ee2344c); ✅ ข้อความเดือนนี้ (โควตาฟรี เหลือเท่าไร ค่าข้อความส่วนเกิน OA ของตัวเอง ส่ง SMS แทนเมื่อเกินโควตา)
- ⬜ ตั้งค่ากฎ fee และผู้รับภาระ fee ต่อตึก, หน้าตรวจสลิป ⛔ API B7.2
- ✅ แจ้งซ่อมสำหรับบ้าน/คอนโด: เจ้าของเลือกใครซ่อม/ใครจ่าย (แบ่งจ่ายได้), แนบใบเสนอราคา/ใบเสร็จ, เรียกเก็บหรือคืนเงินผู้เช่าในบิลถัดไป, ค่าซ่อมส่วนเจ้าของเข้าสรุปรายได้รายปี; ผู้เช่าเห็นใน LINE (api fe40427)
- ⬜ Blue ocean: rent record (D-256), deposit alternative (D-257), rent advance (D-258), รองรับผู้เช่าต่างชาติ (D-260), ไม่มีเดือนว่าง (D-261) ⛔ API + พาร์ทเนอร์

## 5. Admin (web)
- 🟡 F6.5 ✅ ตรวจ/ซ่อน/คืนประกาศ, ยืนยันเจ้าของ (web 4ba5e2a); ✅ อัตราค่าข้อความ LINE (บันทึก/เผยแพร่คนละคน) ที่ Subscriptions › LINE messages; ⬜ ตั้งค่า fee ของแพลตฟอร์ม ⛔ API B7.2 (fee)

## 6. Login (D-255)
- ✅ เบอร์โทร OTP, Google, Apple, LINE สำหรับ owner/landlord (web: หน้าเข้าสู่ระบบ, สมัคร, ตั้งค่า › วิธีเข้าสู่ระบบ) และผู้เช่า/ผู้สนใจเช่า (LIFF: SMS + Google/Apple นอก LINE) — โค้ดครบ ทดสอบกับ fake provider แล้ว (api bb9137b) ⛔ เปิดจริงต้องมี OAuth client: ดู `docs/sign-in-providers.md`

## 7. getproperty-api (Mac)
- ✅ B7.0 ปิด subscription (`platform.subscriptions.enabled=false`), error `subscription.disabled`, runbook SQL (commit 219b3dc, branch `feat/b7-landlords-free-pricing`)
- ✅ B7.1 landlord tenant สมัครเอง (เบอร์โทร OTP, LINE, Google, Apple) + portfolio + ส่งมอบตึก stub ให้นิติ (D-280) (api 040ebaf, asset-core v0.5.0)
- ⬜ B7.2 กฎ fee แบบยืดหยุ่น (%, flat, min, cap, tier, MDR), split settlement, verify slip → บิล fee รายเดือน ⛔ เลือก payment gateway (O-020)
- ✅ B7.3 listings API: `/v1/public/listings`, `/{slug}`, `/sitemap` + ประกาศฝั่งเจ้าของ, ยืนยันเจ้าของ, คิวตรวจประกาศ, รายงานประกาศ (api 13a2562 = prompt 7.2 + public read ของ 7.3; หน้า /rent ใช้ contract จริงแล้ว web f7bda0f)
- ✅ B7.4: สร้างร่างสัญญาจากคนสนใจ (ใช้เงื่อนไขจากประกาศ), สัญญามีผลแล้วปิดประกาศเอง คนอื่นได้ข้อความขอบคุณทาง LINE, เตือนเปิดประกาศใหม่ 60 วันก่อนสัญญาหมด + ปุ่มเปิดประกาศใหม่ในคลิกเดียว (api ede4f71, web — เจ้าของห้องคอนโดในอาคารร่วมสร้างสัญญาได้แล้ว)
- ✅ B7.3 ส่วนที่ 2: ผู้สนใจเช่า (audience `prospect`, เข้าระบบด้วย LINE), ส่งคำถาม, นัดดูห้องจากช่วงเวลาที่เปิด (กันจองซ้อน), เลื่อน/ยกเลิกนัด, กล่องคนสนใจของเจ้าของ (ตอบกลับไปทาง LINE, โน้ต, ปิดได้/ไม่ได้พร้อมเหตุผล), ปฏิทินนัด, เตือนก่อนนัดทั้งสองฝ่าย, เตือนเจ้าของเมื่อยังไม่ตอบ, แจ้งเจ้าของเมื่อประกาศไม่ผ่าน/ถูกซ่อน/ผลยืนยันเจ้าของ (api e742378, D-281) — เหลือ: เข้าระบบผู้สนใจด้วยเบอร์/Google/Apple (B7.8)
- ✅ B7.5 เอกสารครบชุดสำหรับ landlord: ✅ ส่วน 1 สัญญาตามประเภทยูนิต ไทย/อังกฤษ, อากรแสตมป์ (migration 0045, e-Stamp ปิดไว้จนมี adapter), `GET /v1/owner/documents` (api a89c0c1 + 0565fa8, asset-core v0.6.0); ✅ ส่วน 2 หนังสือแจ้ง 5 แบบ เป็น PDF ไทย/อังกฤษ ส่งทาง LINE (migration 0046, api f640c27); ✅ ส่วน 3 หนังสือรับรองค่าเช่า (RPC) + สรุปรายได้ 40(5) รายปี (ISM, แยกค่าบริการตาม D-282, หักเหมา 30% เป็น setting) + สัญญาสองภาษาในไฟล์เดียว (migration 0047, api 0e7ec3a) — ค่าใช้จ่ายของเจ้าของรวมเมื่อทำ B7.6
- ✅ B7.6 แจ้งซ่อมตามประเภท tenant: landlord ใครซ่อม/ใครจ่าย + ใบเสร็จ + เคลียร์ในบิลถัดไป (migration 0049, api fe40427); อพาร์ตเมนต์ใช้คิวช่างเดิม (D-210)
- ✅ B7.7 ✅ ส่วน 1 OA ของตัวเอง: เชื่อม channel (เข้ารหัส secret/token), webhook แยกต่อ channel ตรวจลายเซ็น, ผู้เช่ากดติดตาม → ลิงก์ยืนยันใน LIFF → ข้อความของคนนั้นส่งจาก OA ของเจ้าของ คนที่ยังไม่ยืนยันใช้ OA ของ getproperty (migration 0050, api 218d377; adapter จริง UNVERIFIED จนมี channel); ✅ ส่วน 2 นับข้อความ (OA กลาง/OA ตัวเอง, ตอบกลับไม่นับ), อัตราค่าข้อความ maker-checker, แจ้งเจ้าของ 80/100%, LINE เกินโควตา → ส่ง SMS แทน + แจ้งเจ้าของ, health check OA ตัวเอง, `GET /v1/public/pricing` (migration 0051, api 92e829c); ⬜ rich menu, broadcast ชวนเชื่อม OA ใหม่ — ⛔ เรียกเก็บในใบแจ้งรายเดือนรอ B7.2
- ✅ B7.8 login หลายช่องทาง: `/v1/auth/{operator|resident|prospect}/identity`, prospect SMS OTP, จัดการวิธีเข้าสู่ระบบในโปรไฟล์ (migration 0048, api bb9137b) — รัน fake verifier จนกว่าจะมี client id (D-283)
- ✅ ใช้แพ็กเกจกลาง `@collective/integrations` + `@collective/documents` (D-278) — 358 integration test ผ่าน
- ✅ D-276 นับพื้นที่ต่อเจ้าของ: snapshot รายวัน, แจ้งเตือน 80/100% ทาง LINE, ไม่บล็อกเอกสารตามกฎหมาย, `GET /v1/owner/storage`
- ⬜ บรรทัดค่าพื้นที่ในใบแจ้งค่าบริการรายเดือน ⛔ API B7.2
- ⬜ หลังเสร็จแต่ละข้อ: `pnpm contract:build` แล้วในเว็บรัน `pnpm gen:api` และลบ type ชั่วคราว `listings/contract.ts`

## 8. getproperty-liff (Mac)
- ✅ L5 5.1 (ตาม prompt): ผู้สนใจเช่าใน LINE — เปิดประกาศจากลิงก์, ถามเจ้าของ/นัดดูห้องจากเวลาว่าง, ยินยอม PDPA ครั้งแรก, คำถามของฉัน, เปลี่ยนเวลา/ยกเลิก/นำทาง (liff 1827ba2) — ✅ ปุ่มบนหน้า /rent ของเว็บเปิด LIFF โดยตรงเมื่อตั้ง `NEXT_PUBLIC_LIFF_ID` (ตัวอย่างใน .env.example แล้ว); เหลือ: เข้าระบบด้วยเบอร์/Google/Apple (B7.8)
- ⬜ L5.1 แจ้งซ่อมผ่าน LINE พร้อมรูป
- ⬜ L5.2 บิล/ใบเสร็จ/สัญญาสำหรับผู้เช่าบ้าน/คอนโด
- ⬜ L5.3 login แบบใหม่
- ✅ ยืนยันบัญชีกับ LINE OA ของเจ้าของ `/link/oa?t=` (6 ภาษา, liff 50aa2ae)
- ⬜ L5.4 rent record ของผู้เช่า (แชร์ได้เมื่อยินยอม)

## 9. งานที่คุณต้องทำ / ตัดสินใจ
- ⬜ LINE OA ID, เบอร์โทร, อีเมลติดต่อ (ถ้าไม่มี ปุ่ม LINE จะซ่อนไว้)
- ⬜ เลือก payment gateway ที่มี sub-merchant + split (O-020)
- ⬜ ทนายตรวจ wording: สัญญามาตรฐาน (O-017), เงื่อนไขประกาศ (O-018), อากรแสตมป์ e-Stamp (O-019) โดยตอนนี้ระบบเปิดใช้ตามค่าที่ผมแนะนำไว้ก่อน
- ⬜ คำรีวิวจากลูกค้าจริง (ใส่แทนช่องว่าง ห้ามแต่งเอง)
- ⬜ รูปถ่ายจริงของตึก/ห้อง (ตอนนี้ใช้ Unsplash ซึ่งมีเครดิตที่ footer แล้ว)
- ⚠️ ย้ายไฟล์ AWS access key (.csv) และ Firebase admin JSON ในโฟลเดอร์ Collective ไปเก็บที่ปลอดภัย และ rotate key

## 10. ปิดงานรอบนี้ (web)
- ✅ บันทึก PROGRESS.md
- ✅ typecheck / lint / unit 1,083 / e2e 163 / build ผ่าน (Node 24, sandbox)
- ✅ commit แล้ว merge เข้า `main` ทุก repo (ยังไม่ push) — ไฟล์ส่วนตัวของคุณถูกเอาออกจาก git แต่ยังอยู่ในเครื่องครบ
- ⬜ ภาพหน้าจอ 1440/390 ทุกหน้าส่งให้คุณดู
- ✅ ลบไฟล์ชั่วคราวใน `_xfer`

## 11. แพ็กเกจกลาง และคิดเงินตามพื้นที่ (D-275, D-276)
- ✅ repo `collective-shared` (`~/Collective/collective-shared`): `@collective/integrations`, `@collective/documents`, `@collective/content`, `@collective/web-kit` 0.1 — 59 tests ผ่าน
- ✅ prompt ให้ getpack และ getproperty เปลี่ยนมาใช้แพ็กเกจ (`collective-shared/docs/adoption/`)
- ✅ adoption: getproperty-api, getproperty-web (+ แก้แพ็กเกจ: code splitting, safeReturnTo เข้มขึ้น)
- ⬜ adoption: getpack-api → getpack-web — prompt พร้อมแล้วที่ `~/Collective/getpack/HANDOFF-collective-shared.md` ⛔ commit งานค้างใน getpack-web ก่อน
- ⬜ push ทุก repo + collective-shared (private, `Collective-Group-Thailand/collective-shared`) และสร้าง secret `ASSET_CORE_READ_TOKEN` ⛔ คุณ
- ⬜ ตั้ง GitHub Packages ⛔ คุณ
- ✅ นับพื้นที่ต่อเจ้าของ (ค่าเริ่มต้น = ยังไม่จำกัด)
- ✅ พื้นที่ฟรี 5 GB ทุกประเภทลูกค้า (D-279)
- ✅ หน้า admin → การสมัครใช้งาน → พื้นที่จัดเก็บ: ตั้งพื้นที่ฟรี/ราคาส่วนเกิน/แพ็กเสริม/ระดับแจ้งเตือน และดูการใช้งานทุกบัญชี
- ⬜ ตั้งราคาส่วนเกินและแพ็กเสริมจริงในหน้า admin ⛔ คุณ (ตอนนี้ = ไม่ขาย)

## 12. ทำงานต่อข้าม account
- ✅ `RESUME.md` (สถานะ + ล็อก) และ `HANDOFF-PROMPT.md` ใน `Collective/getproperty`
