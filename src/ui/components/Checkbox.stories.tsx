import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Forms/Checkbox",
  component: Checkbox,
  args: { label: "ส่งบิลทาง LINE", description: "ผู้เช่าจะได้รับบิลพร้อม QR ทันทีที่ออกบิล" },
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = {
  args: { checked: "indeterminate", label: "เลือกทั้งหมด", description: undefined },
};
export const Disabled: Story = { args: { disabled: true } };
