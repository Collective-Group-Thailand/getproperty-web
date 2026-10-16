import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconButton } from "./IconButton";

const meta: Meta<typeof IconButton> = {
  title: "Foundations/IconButton",
  component: IconButton,
  args: { name: "more", label: "เพิ่มเติม" },
};
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {};
export const Secondary: Story = { args: { variant: "secondary", name: "edit", label: "แก้ไข" } };
export const Primary: Story = { args: { variant: "primary", name: "camera", label: "ถ่ายรูปมิเตอร์", size: "lg" } };
