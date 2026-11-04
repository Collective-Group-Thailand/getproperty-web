import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatsRow } from "./StatsRow";

const meta: Meta<typeof StatsRow> = {
  title: "Data/StatsRow",
  component: StatsRow,
  args: {
    label: "ภาพรวมเงินประกัน",
    highlight: "overdue",
    figures: [
      { key: "held", label: "ถืออยู่", value: "3", hint: "฿15,000.00" },
      { key: "returning", label: "กำลังคืน", value: "2" },
      { key: "due", label: "ใกล้ครบกำหนดคืน", value: "1" },
      { key: "overdue", label: "คืนล่าช้า", value: "1", hint: "เลยกำหนด 2 วัน", href: "#overdue" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof StatsRow> = {};

/** Aging (arrears): the total as the key cell, each bucket with its share as a thin bar, overdue money in amber. */
export const WithShares: StoryObj<typeof StatsRow> = {
  args: {
    label: "อายุหนี้",
    highlight: "total",
    figures: [
      { key: "total", label: "ยอดค้างรวม", value: "฿12,694.00", hint: "2 ราย" },
      { key: "current", label: "ยังไม่ถึงกำหนด", value: "฿5,512.00", share: 43 },
      { key: "d1_30", label: "1–30 วัน", value: "—", share: 0 },
      { key: "d31_60", label: "31–60 วัน", value: "฿7,182.00", share: 57, shareTone: "warning" },
      { key: "d61_90", label: "61–90 วัน", value: "—", share: 0 },
      { key: "d90p", label: "เกิน 90 วัน", value: "—", share: 0 },
    ],
  },
};
