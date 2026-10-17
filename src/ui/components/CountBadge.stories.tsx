import type { Meta, StoryObj } from "@storybook/react-vite";

import { CountBadge } from "./CountBadge";
import { IconButton } from "./IconButton";
import { IconBell } from "../icons/glyphs/bell";

const meta: Meta<typeof CountBadge> = {
  title: "Patterns/CountBadge",
  component: CountBadge,
  args: { count: 3 },
  render: (args) => (
    <span className="relative inline-flex">
      <IconButton icon={IconBell} label={`การแจ้งเตือน, ยังไม่อ่าน ${args.count}`} />
      <CountBadge {...args} />
    </span>
  ),
};
export default meta;
type Story = StoryObj<typeof CountBadge>;

export const Default: Story = {};
export const Many: Story = { args: { count: 120 } };
