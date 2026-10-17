import type { Meta, StoryObj } from "@storybook/react-vite";

import { CountBadge } from "./CountBadge";
import { IconButton } from "./IconButton";

const meta: Meta<typeof CountBadge> = {
  title: "Patterns/CountBadge",
  component: CountBadge,
  args: { count: 3 },
  render: (args) => (
    <span className="relative inline-flex">
      <IconButton name="bell" label={`การแจ้งเตือน, ยังไม่อ่าน ${args.count}`} />
      <CountBadge {...args} />
    </span>
  ),
};
export default meta;
type Story = StoryObj<typeof CountBadge>;

export const Default: Story = {};
export const Many: Story = { args: { count: 120 } };
