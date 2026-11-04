import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection, PaperTotals } from "./Paper";
import { Statement } from "./Statement";

const meta: Meta<typeof Paper> = { title: "Data/Paper", component: Paper };
export default meta;

export const Invoice: StoryObj<typeof Paper> = {
  render: () => (
    <Paper label="ใบแจ้งหนี้ INV-2569-000101">
      <PaperHead
        kind="ใบแจ้งหนี้"
        number="INV-2569-000101"
        status={<Badge tone="warning">ค้างชำระ</Badge>}
        facts={[
          { key: "issued", label: "ออกเมื่อ", value: "1 พ.ย. 2569" },
          { key: "due", label: "ครบกำหนด", value: "5 พ.ย. 2569" },
        ]}
      />
      <PaperParties
        items={[
          { key: "party", label: "เรียกเก็บจาก", value: "สมศักดิ์ ใจดี" },
          { key: "unit", label: "ห้อง", value: "A-201", detail: "อาคาร A" },
          { key: "period", label: "รอบบิล", value: "1–31 ต.ค. 2569" },
        ]}
      />
      <PaperSection title="รายการ">
        <p className="text-muted">ค่าเช่า ค่าไฟฟ้า ค่าน้ำประปา</p>
      </PaperSection>
      <PaperTotals>
        <Statement
          caption="ยอดรวม"
          lines={[
            { key: "subtotal", label: "รวมก่อนภาษี", value: "฿5,966.40" },
            { key: "vat", label: "ภาษีมูลค่าเพิ่ม", value: "฿0.00" },
            { key: "total", label: "ยอดบิล", value: "฿5,966.40", kind: "subtotal" },
            { key: "due", label: "ยอดที่ต้องชำระ", value: "฿5,966.40", kind: "result" },
          ]}
        />
      </PaperTotals>
      <PaperFoot>
        <span>ชำระผ่าน PromptPay อ้างอิง 0123456789</span>
      </PaperFoot>
    </Paper>
  ),
};
