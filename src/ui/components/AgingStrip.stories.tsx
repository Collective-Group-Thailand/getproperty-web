import type { Meta, StoryObj } from "@storybook/react-vite";

import { AgingStrip } from "./AgingStrip";

const meta: Meta<typeof AgingStrip> = {
  title: "Data/AgingStrip",
  component: AgingStrip,
  args: {
    label: "อายุหนี้ค้างชำระ",
    tiles: [
      { key: "0-30", label: "1–30 วัน", count: "18 ราย", amount: "฿248,400.00" },
      { key: "31-90", label: "31–90 วัน", count: "11 ราย", amount: "฿312,800.00" },
      { key: "91-365", label: "91–365 วัน", count: "8 ราย", amount: "฿284,520.00" },
      { key: "365+", label: "เกิน 365 วัน", count: "4 ราย", amount: "฿298,600.00", badge: "เกิน 1 ปี" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof AgingStrip> = {};

/** Each tile opens the rows it counts. */
export const Linked: StoryObj<typeof AgingStrip> = {
  args: {
    tiles: [
      { key: "0-30", label: "1–30 วัน", count: "2 ราย", amount: "฿4,200.00", href: "#a" },
      { key: "31-90", label: "31–90 วัน", count: "0 ราย", amount: "฿0.00", href: "#b" },
      { key: "91-365", label: "91–365 วัน", count: "0 ราย", amount: "฿0.00", href: "#c" },
      { key: "365+", label: "เกิน 365 วัน", count: "1 ราย", amount: "฿12,960.00", badge: "เกิน 1 ปี", href: "#d" },
    ],
  },
};
