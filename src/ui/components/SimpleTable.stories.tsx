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

/** Rows that open a record, stacked as a list of rows on a phone (title and figure on top, status at the end). */
export const StackedOnPhones: Story = {
  args: {
    stackOnPhones: true,
    columns: [
      { key: "number", header: "เลขที่", phone: "meta" },
      { key: "tenant", header: "ลูกค้า", phone: "title" },
      { key: "status", header: "สถานะ", phone: "status" },
      { key: "total", header: "ยอดรวม", align: "end", phone: "figure" },
    ],
    rows: [
      {
        key: "1",
        href: "#1",
        cells: { number: "PINV-2026-0001", tenant: "หอพักสุขใจ", status: "ชำระแล้ว", total: "฿1,605.00" },
      },
      {
        key: "2",
        href: "#2",
        cells: { number: "PINV-2026-0002", tenant: "บ้านสวนอพาร์ตเมนต์", status: "ค้างชำระ", total: "฿2,140.00" },
      },
    ],
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

/** Bare counts named by their header in a phone row (`phoneLabel`): "ออนไลน์ 3 · ออฟไลน์ 1", never "3 / 1". */
export const PhoneLabels: Story = {
  args: {
    caption: "เกตเวย์รายอาคาร",
    stackOnPhones: true,
    columns: [
      { key: "building", header: "อาคาร", phone: "title" },
      { key: "online", header: "ออนไลน์", align: "end", phoneLabel: true },
      { key: "offline", header: "ออฟไลน์", align: "end", phoneLabel: true },
    ],
    rows: [
      { key: "a", cells: { building: "อาคาร A", online: "3", offline: "0" } },
      { key: "b", cells: { building: "อาคาร B", online: "1", offline: "1" } },
    ],
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
