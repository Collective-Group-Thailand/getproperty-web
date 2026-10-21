import type { Meta, StoryObj } from "@storybook/react-vite";

import { CURRENT_TENANT, TENANTS } from "@/features/shared/storybook/fixtures";
import { ShellStory } from "@/features/shared/storybook/ShellStory";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";

import { DeviceLock } from "../lock/DeviceLock";
import { StaffShellFrame } from "./StaffShellFrame";

const meta: Meta<typeof StaffShellFrame> = {
  title: "Shells/Staff",
  component: StaffShellFrame,
  parameters: { layout: "fullscreen" },
  globals: { zone: "staff" },
  decorators: [
    (Story) => (
      <ShellStory zone="staff" pathname="/">
        <DeviceLock loginHref="/login">
          <Story />
        </DeviceLock>
      </ShellStory>
    ),
  ],
  args: {
    userId: "3b241101-e2bb-4255-8caf-4136c566a962",
    tenants: [TENANTS[0]!],
    currentTenant: { ...CURRENT_TENANT, role: "staff" },
    userName: "สมศักดิ์ ช่างประจำ",
    roleLabel: "เจ้าหน้าที่",
    items: [
      { key: "readings", href: "/readings", icon: IconMeter, label: "จดมิเตอร์", group: "work" },
      { key: "inspections", href: "/inspections", icon: IconCamera, label: "ตรวจห้อง", group: "work" },
      { key: "installs", href: "/devices", icon: IconGateway, label: "อุปกรณ์", group: "work" },
    ],
    todayLabel: "วันนี้",
    envBadge: "uat",
    children: (
      <div className="py-6">
        <h1 className="text-2xl font-semibold">วันนี้</h1>
        <p className="text-muted mt-2">รอบจดมิเตอร์อาคาร A · 42 ห้อง</p>
      </div>
    ),
  },
};
export default meta;
type Story = StoryObj<typeof StaffShellFrame>;

export const Phone: Story = {};
