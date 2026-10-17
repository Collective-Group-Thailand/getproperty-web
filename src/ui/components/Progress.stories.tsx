import type { Meta, StoryObj } from "@storybook/react-vite";

import { Progress } from "./Progress";

const meta: Meta<typeof Progress> = {
  title: "Data display/Progress",
  component: Progress,
  args: { label: "รอบจดมิเตอร์", value: 8, max: 20, valueText: "จดแล้ว 8 จาก 20 จุด" },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Progress>;

export const Partway: Story = {};
export const Done: Story = { args: { value: 20, valueText: "จดครบ 20 จุดแล้ว" } };
export const Empty: Story = { args: { value: 0, max: 0, valueText: "ไม่มีมิเตอร์ต้องจด" } };
