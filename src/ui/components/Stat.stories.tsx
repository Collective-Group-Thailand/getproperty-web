import type { Meta, StoryObj } from "@storybook/react-vite";

import { Stat } from "./Stat";

const meta: Meta<typeof Stat> = {
  title: "Data/Stat",
  component: Stat,
  args: { label: "เก็บได้แล้วเดือนนี้", value: "฿186,420.00", hint: "จาก 42 ห้อง", icon: "payment" },
};
export default meta;
type Story = StoryObj<typeof Stat>;

export const Default: Story = {};
export const Trend: Story = {
  args: {
    label: "ค้างชำระ",
    value: "฿9,700.00",
    icon: "clock",
    trend: { direction: "down", label: "-2 ห้อง", good: true },
    hint: "เทียบเดือนก่อน",
  },
};
export const Recovered: Story = {
  args: {
    label: "ค่าไฟที่หายไป (ส่วนกลาง)",
    value: "312 kWh",
    icon: "electric",
    variant: "recovered",
    trend: { direction: "up", label: "+8%", good: false },
    hint: "≈ ฿1,300",
  },
};
export const Grid: Story = {
  render: (args) => (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat {...args} />
      <Stat label="รอตรวจสลิป" value="3" icon="bill" hint="ก่อน 12:00" />
      <Stat label="ห้องว่าง" value="2" icon="room" hint="จาก 42 ห้อง" />
    </div>
  ),
};
