import type { Meta, StoryObj } from "@storybook/react-vite";

import { FactGrid } from "./FactGrid";

const meta: Meta<typeof FactGrid> = {
  title: "Data/FactGrid",
  component: FactGrid,
  args: {
    label: "สุขภาพบัญชี",
    facts: [
      { key: "plan", label: "แพ็กเกจ", value: "Apartment Starter" },
      { key: "units", label: "ห้องที่นับวันนี้", value: "40", numeric: true },
      { key: "buildings", label: "อาคาร", value: "3", numeric: true },
      { key: "cycle", label: "รอบบิลล่าสุด", value: "ต.ค. 2569" },
      { key: "gateways", label: "เกตเวย์ออนไลน์", value: "1 จาก 2", tone: "warning", hint: "ออฟไลน์ 1 เครื่อง" },
      { key: "overdue", label: "ค้างชำระเกินกำหนด", value: "฿0.00", numeric: true },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof FactGrid> = {};
