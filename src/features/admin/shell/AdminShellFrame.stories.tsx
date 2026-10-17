import type { Meta, StoryObj } from "@storybook/react-vite";

import { ADMIN_GROUPS } from "@/features/shared/storybook/fixtures";
import { ShellStory } from "@/features/shared/storybook/ShellStory";

import { AdminShellFrame } from "./AdminShellFrame";

const meta: Meta<typeof AdminShellFrame> = {
  title: "Shells/Admin",
  component: AdminShellFrame,
  parameters: { layout: "fullscreen" },
  globals: { zone: "admin" },
  decorators: [
    (Story) => (
      <ShellStory zone="admin" pathname="/tenants">
        <Story />
      </ShellStory>
    ),
  ],
  args: {
    userName: "Admin Test",
    rolesLabel: "ผู้ดูแลแพลตฟอร์ม",
    groups: ADMIN_GROUPS,
    envBadge: "development",
    apiFakes: true,
    fakesLabel: "API ใช้ข้อมูลจำลอง",
    children: (
      <div className="px-4 py-6 md:px-8">
        <h1 className="text-2xl font-semibold">องค์กรลูกค้า</h1>
      </div>
    ),
  },
};
export default meta;
type Story = StoryObj<typeof AdminShellFrame>;

export const Desktop: Story = {};
