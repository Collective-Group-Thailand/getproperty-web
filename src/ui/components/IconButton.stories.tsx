import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconCamera } from "../icons/glyphs/camera";
import { IconEdit } from "../icons/glyphs/edit";
import { IconMore } from "../icons/glyphs/more";
import { IconButton } from "./IconButton";

const meta: Meta<typeof IconButton> = {
  title: "Foundations/IconButton",
  component: IconButton,
  args: { icon: IconMore, label: "เพิ่มเติม" },
};
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {};
export const Secondary: Story = { args: { variant: "secondary", icon: IconEdit, label: "แก้ไข" } };
export const Primary: Story = { args: { variant: "primary", icon: IconCamera, label: "ถ่ายรูปมิเตอร์", size: "lg" } };
