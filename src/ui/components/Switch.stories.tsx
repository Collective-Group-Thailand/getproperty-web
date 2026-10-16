import type { Meta, StoryObj } from "@storybook/react-vite";

import { Switch } from "./Switch";

const meta: Meta<typeof Switch> = {
  title: "Forms/Switch",
  component: Switch,
  args: { label: "แจ้งเตือนเมื่อมีสลิปรอตรวจ", description: "ส่งทาง LINE ทันที" },
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
