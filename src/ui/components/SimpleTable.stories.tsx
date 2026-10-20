import type { Meta, StoryObj } from "@storybook/react-vite";

import { SimpleTable } from "./SimpleTable";

const meta: Meta<typeof SimpleTable> = {
  title: "Data/SimpleTable",
  component: SimpleTable,
  args: {
    caption: "ใบแจ้งหนี้แพลตฟอร์ม",
    columns: [
      { key: "number", header: "เลขที่" },
      { key: "tenant", header: "ลูกค้า" },
      { key: "total", header: "ยอดรวม", align: "end" },
    ],
    rows: [
      { key: "1", cells: { number: "PINV-2026-0001", tenant: "หอพักสุขใจ", total: "฿1,605.00" } },
      {
        key: "2",
        tone: "warning",
        cells: { number: "PINV-2026-0002", tenant: "บ้านสวนอพาร์ตเมนต์", total: "฿2,140.00" },
      },
      { key: "3", tone: "danger", cells: { number: "PINV-2026-0003", tenant: "ริมน้ำเรสซิเดนซ์", total: "฿5,350.00" } },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof SimpleTable>;

export const Default: Story = {};
export const Narrow: Story = { args: { minWidth: "48rem" }, parameters: { viewport: { defaultViewport: "mobile1" } } };
