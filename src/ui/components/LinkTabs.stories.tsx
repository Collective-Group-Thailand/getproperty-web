import type { Meta, StoryObj } from "@storybook/react-vite";

import { LinkTabs } from "./LinkTabs";

const meta: Meta<typeof LinkTabs> = {
  title: "Navigation/LinkTabs",
  component: LinkTabs,
  args: {
    label: "การเงิน",
    current: "/payments/slips",
    tabs: [
      { href: "/payments", label: "รับชำระ" },
      { href: "/payments/slips", label: "ตรวจสลิป", count: 3 },
      { href: "/arrears", label: "ค้างชำระ" },
      { href: "/payments/credits", label: "เครดิตและคืนเงิน" },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof LinkTabs>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
