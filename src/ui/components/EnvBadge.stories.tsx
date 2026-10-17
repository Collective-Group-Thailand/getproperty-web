import type { Meta, StoryObj } from "@storybook/react-vite";

import { EnvBadge } from "./EnvBadge";

const meta: Meta<typeof EnvBadge> = {
  title: "Patterns/EnvBadge",
  component: EnvBadge,
  args: { label: "uat" },
};
export default meta;
type Story = StoryObj<typeof EnvBadge>;

export const Default: Story = {};
export const Staging: Story = { args: { label: "staging" } };
