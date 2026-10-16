import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "./Icon";
import { ICON_NAMES } from "./registry";

const meta: Meta<typeof Icon> = {
  title: "Foundations/Icon",
  component: Icon,
  args: { name: "meter", label: "มิเตอร์" },
};
export default meta;
type Story = StoryObj<typeof Icon>;

export const Single: Story = {};
export const Registry: Story = {
  render: () => (
    <ul className="grid grid-cols-4 gap-3 text-sm sm:grid-cols-6 md:grid-cols-8">
      {ICON_NAMES.map((name) => (
        <li key={name} className="border-border rounded-control flex flex-col items-center gap-2 border p-3">
          <Icon name={name} className="text-2xl" />
          <code className="text-muted text-xs">{name}</code>
        </li>
      ))}
    </ul>
  ),
};
