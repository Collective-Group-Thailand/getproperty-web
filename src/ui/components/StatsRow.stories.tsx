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
