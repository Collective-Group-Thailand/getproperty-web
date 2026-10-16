import type { Meta, StoryObj } from "@storybook/react-vite";

import { Wordmark } from "../brand";
import { Icon } from "../icons";
import { AppShell, BottomNav, SidebarNav, TopBar } from "./AppShell";
import { Stat } from "./Stat";

const OWNER_NAV = [
  { href: "#", label: "เช้านี้", icon: <Icon name="dashboard" />, active: true },
  { href: "#", label: "อาคารและห้อง", icon: <Icon name="building" /> },
  { href: "#", label: "บิล", icon: <Icon name="bill" /> },
  { href: "#", label: "มิเตอร์", icon: <Icon name="meter" /> },
];

const STAFF_NAV = [
  { href: "#", label: "วันนี้", icon: <Icon name="ticket" />, active: true },
  { href: "#", label: "จดมิเตอร์", icon: <Icon name="meter" /> },
  { href: "#", label: "ตรวจห้อง", icon: <Icon name="camera" /> },
  { href: "#", label: "อุปกรณ์", icon: <Icon name="gateway" /> },
];

const meta: Meta<typeof AppShell> = {
  title: "Patterns/AppShell",
  component: AppShell,
  args: { skipLabel: "ข้ามไปยังเนื้อหา", sidebarLabel: "เมนูหลัก" },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppShell>;

export const Console: Story = {
  render: (args) => (
    <AppShell
      {...args}
      header={
        <TopBar>
          <Wordmark size="sm" />
          <span className="text-muted text-sm">เจ้าของ</span>
        </TopBar>
      }
      sidebar={<SidebarNav items={OWNER_NAV} />}
    >
      <div className="p-6">
        <h1 className="mb-4 text-2xl">เช้านี้</h1>
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="รอตรวจสลิป" value="3" icon="bill" />
          <Stat label="ค้างชำระ" value="฿9,700.00" icon="clock" />
          <Stat label="ห้องว่าง" value="2" icon="room" />
        </div>
      </div>
    </AppShell>
  ),
};

export const Collapsed: Story = {
  render: (args) => (
    <AppShell
      {...args}
      sidebarCollapsed
      header={
        <TopBar>
          <Wordmark size="sm" compact />
        </TopBar>
      }
      sidebar={<SidebarNav items={OWNER_NAV} collapsed />}
    >
      <div className="p-6">
        <h1 className="text-2xl">เช้านี้</h1>
      </div>
    </AppShell>
  ),
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1" } },
  render: (args) => (
    <AppShell
      {...args}
      variant="mobile"
      header={
        <TopBar>
          <Wordmark size="sm" />
        </TopBar>
      }
      bottomNav={<BottomNav items={STAFF_NAV} label="เมนูด่วน" />}
    >
      <div className="py-6">
        <h1 className="text-2xl">งานวันนี้</h1>
      </div>
    </AppShell>
  ),
};
