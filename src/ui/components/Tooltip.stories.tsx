import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tooltip } from "./Tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  args: { content: "17 ก.ย. 2569 09:42" },
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const RelativeTime: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <button type="button" className="text-muted rounded-control underline decoration-dotted underline-offset-4">
        5 นาทีที่แล้ว
      </button>
    </Tooltip>
  ),
};
