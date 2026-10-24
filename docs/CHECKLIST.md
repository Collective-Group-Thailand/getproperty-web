# getproperty: Master checklist (24 ต.ค. 2026)

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
- 🟡 Navbar ใหม่ (เมนูกลาง, เส้นใต้หน้าปัจจุบัน, ปุ่ม "เริ่มใช้ฟรี"/"ลงประกาศฟรี" ตามหน้า, เมนูมือถือ)
- 🟡 /rent หน้าค้นหาห้องเช่า: ค้นตามย่าน/ประเภท/ราคา/ห้องนอน/สัตว์เลี้ยง/เรียงลำดับ, ตัวกรองอยู่ใน URL
- 🟡 /rent/[slug] หน้ารายละเอียด: แกลเลอรี, ข้อมูลห้อง, ที่อยู่เต็ม + Google Maps, ติดต่อเจ้าของทาง LINE, badge ยืนยันเจ้าของ, รายงานประกาศ, ห้องคล้ายกัน
- 🟡 เอาป้าย "เร็ว ๆ นี้" ออกจากทุกหน้า
- 🔄 ขัดเกลาดีไซน์จากภาพหน้าจอ 1440/390 ทุกหน้า (แผงค้นหา, แกลเลอรี, ระยะห่าง)
- ⬜ เทียบกับ canvas "getproperty Website Redesign" ทีละ section แล้วแก้จุดที่ยังห่าง
- ⬜ หน้าภาษาอังกฤษ: ตรวจทุกหน้าว่าโครงตรงกับภาษาไทยและคำแปลเป็นธรรมชาติ
- ⬜ หน้า /rent ฝั่งผู้เช่า: บันทึกห้องที่ชอบ, แจ้งเตือนเมื่อมีห้องใหม่ตรงเงื่อนไข (ทาง LINE) ⛔ API B7.3
- ⬜ แบบฟอร์มรายงานประกาศ (scam) และหน้าเงื่อนไขการลงประกาศ ⛔ ร่างจาก O-018
- ⬜ Analytics events: cta_start, cta_list, cta_line, listing_view, listing_contact, search_used
- ⬜ Lighthouse ≥ 95 (Performance/Accessibility/SEO) ทุกหน้า, ไม่มี scroll แนวนอนที่ 360px

## 3. SEO / GEO / AEO (แบบ getpack)
- ✅ Meta title/description ไทย-อังกฤษ, canonical, hreflang, OG image ทุกหน้า
- 🟡 JSON-LD: Organization, WebSite + SearchAction, SoftwareApplication (ราคา 0), FAQPage, BreadcrumbList, ItemList, Offer + Apartment/House ต่อประกาศ
- 🟡 sitemap.xml รวม URL ประกาศทุกอัน (ดึงจาก API)
- 🟡 robots.txt เปิด /rent, /rent/*, /landlords, /llms.txt
- 🟡 /llms.txt สรุปเป็น markdown สำหรับ AI (ข้อเท็จจริง, หน้า, FAQ 3 ชุด, ประกาศล่าสุด)
- ⬜ หน้า landing ตามพื้นที่ (เช่น "คอนโดให้เช่า อารีย์") สร้างจากข้อมูลประกาศจริง ⛔ ต้องมีประกาศพอ
- ⬜ หน้าบทความ/คู่มือ (เช่น สัญญาเช่าต้องมีอะไร, ตม.30 คืออะไร) เพื่อ AEO
- ⬜ ลงทะเบียน Google Search Console / Bing, ส่ง sitemap ⛔ คุณ (ต้องใช้บัญชีโดเมน)

## 4. Owner console (web: `src/app/[locale]/(console)`)
- ✅ หน้าเดิมทั้งหมด (dashboard, ตึก, ห้อง, มิเตอร์, บิล, ชำระเงิน, เงินประกัน, สัญญา, แจ้งซ่อม, ตม.30, รายงาน ฯลฯ) ใช้ฟอนต์/ขนาดใหม่แล้ว
- ⬜ รีวิวดีไซน์ทุกหน้าด้วยภาพหน้าจอ (dev:mock) แล้วแก้ให้ตรงกับเว็บใหม่
- ⬜ เอาหน้า /subscription ออกหรือเปลี่ยนเป็น "ค่าธรรมเนียมรายเดือน" (ใบแจ้ง fee จาก verify slip) ⛔ API B7.2
- ⬜ F6.1 สมัครเองสำหรับเจ้าของบ้าน/คอนโด + console แบบ portfolio ⛔ API B7.1
- ⬜ F6.2 แก้ไขประกาศ (รูป ≥ 5, ราคา, เงื่อนไข), กล่องคนสนใจ, นัดดูห้อง ⛔ API B7.2–7.4
- ⬜ F6.4 เอกสารครบชุด: สัญญาเช่า, ใบแจ้งหนี้, ใบเสร็จ, หนังสือแจ้ง, ใบตรวจสภาพห้อง, สรุปภาษีรายปี ⛔ API B7.5
- ⬜ F6.6 ตั้งค่า LINE OA ของตัวเอง / ใช้ของ getproperty + ดูยอดข้อความ ⛔ API B7.7
- ⬜ ตั้งค่ากฎ fee และผู้รับภาระ fee ต่อตึก, หน้าตรวจสลิป ⛔ API B7.2
- ⬜ แจ้งซ่อมสำหรับบ้าน/คอนโด: เจ้าของรับทราบ ตัดสินใจว่าใครซ่อม/ใครจ่าย (D-263) ⛔ API B7.6
- ⬜ Blue ocean: rent record (D-256), deposit alternative (D-257), rent advance (D-258), รองรับผู้เช่าต่างชาติ (D-260), ไม่มีเดือนว่าง (D-261) ⛔ API + พาร์ทเนอร์

## 5. Admin (web)
- ⬜ F6.5 ตรวจ/ซ่อนประกาศ, ยืนยันเจ้าของ, ตั้งค่า fee ของแพลตฟอร์ม ⛔ API B7.3/B7.2

## 6. Login (D-255)
- ⬜ เบอร์โทร OTP, Google, Apple, LINE สำหรับ owner/landlord (web) และผู้เช่า (LIFF) ⛔ API B7.8 + คุณสร้าง OAuth client ของ Google/Apple

## 7. getproperty-api (Mac)
- ✅ B7.0 ปิด subscription (`platform.subscriptions.enabled=false`), error `subscription.disabled`, runbook SQL (commit 219b3dc, branch `feat/b7-landlords-free-pricing`)
- ⬜ B7.1 landlord tenant สมัครเอง + portfolio
- ⬜ B7.2 กฎ fee แบบยืดหยุ่น (%, flat, min, cap, tier, MDR), split settlement, verify slip → บิล fee รายเดือน ⛔ เลือก payment gateway (O-020)
- ⬜ B7.3 listings API: `/v1/public/listings`, `/{slug}`, `/sitemap` (หน้าเว็บใช้ mock ตาม contract ที่ผมส่งไว้)
- ⬜ B7.4 คนสนใจ, นัดดูห้อง
- ⬜ B7.5 เอกสารครบชุดสำหรับ landlord
- ⬜ B7.6 แจ้งซ่อมตามประเภท tenant
- ⬜ B7.7 LINE OA ของตัวเอง / ค่าข้อความ
- ⬜ B7.8 login หลายช่องทาง
- ⬜ หลังเสร็จแต่ละข้อ: `pnpm contract:build` แล้วในเว็บรัน `pnpm gen:api` และลบ type ชั่วคราว `listings/contract.ts`

## 8. getproperty-liff (Mac)
- ⬜ L5.1 แจ้งซ่อมผ่าน LINE พร้อมรูป
- ⬜ L5.2 บิล/ใบเสร็จ/สัญญาสำหรับผู้เช่าบ้าน/คอนโด
- ⬜ L5.3 login แบบใหม่
- ⬜ L5.4 rent record ของผู้เช่า (แชร์ได้เมื่อยินยอม)

## 9. งานที่คุณต้องทำ / ตัดสินใจ
- ⬜ LINE OA ID, เบอร์โทร, อีเมลติดต่อ (ถ้าไม่มี ปุ่ม LINE จะซ่อนไว้)
- ⬜ เลือก payment gateway ที่มี sub-merchant + split (O-020)
- ⬜ ทนายตรวจ wording: สัญญามาตรฐาน (O-017), เงื่อนไขประกาศ (O-018), อากรแสตมป์ e-Stamp (O-019) โดยตอนนี้ระบบเปิดใช้ตามค่าที่ผมแนะนำไว้ก่อน
- ⬜ คำรีวิวจากลูกค้าจริง (ใส่แทนช่องว่าง ห้ามแต่งเอง)
- ⬜ รูปถ่ายจริงของตึก/ห้อง (ตอนนี้ใช้ Unsplash ซึ่งมีเครดิตที่ footer แล้ว)
- ⚠️ ย้ายไฟล์ AWS access key (.csv) และ Firebase admin JSON ในโฟลเดอร์ Collective ไปเก็บที่ปลอดภัย และ rotate key

## 10. ปิดงานรอบนี้ (web)
- ⬜ เพิ่ม endpoint ประกาศใน `docs/contract-requests.md`, บันทึก PROGRESS.md
- ⬜ รัน typecheck / lint / unit (ล่าสุดผ่าน 1,052 test) / e2e บน Mac
- ⬜ Patch ลง Mac แล้ว commit บน `feat/marketing-redesign-landlords` (ไม่แตะ `.env.example`, `package.json` dev port, `.vscode/` ของคุณ)
- ⬜ ภาพหน้าจอ 1440/390 ทุกหน้าส่งให้คุณดู
- ⬜ ลบโฟลเดอร์ชั่วคราว `_xfer`
