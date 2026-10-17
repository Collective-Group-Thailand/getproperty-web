import type { Meta, StoryObj } from "@storybook/react-vite";

import { BUILDINGS, CURRENT_TENANT, OWNER_GROUPS, TENANTS } from "@/features/shared/storybook/fixtures";
import { ShellStory } from "@/features/shared/storybook/ShellStory";
import { Callout } from "@/ui/components/Callout";
import { Stat } from "@/ui/components/Stat";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconRoom } from "@/ui/icons/glyphs/room";

import { OwnerShellFrame } from "./OwnerShellFrame";

const items = OWNER_GROUPS.flatMap((group) => group.items);
const bottomNav = [
  { item: items.find((i) => i.key === "dashboard")!, label: "วันนี้" },
  { item: items.find((i) => i.key === "units")!, label: "ห้อง" },
  { item: items.find((i) => i.key === "invoices")!, label: "บิล" },
  { item: items.find((i) => i.key === "payments")!, label: "รับเงิน" },
];

const meta: Meta<typeof OwnerShellFrame> = {
  title: "Shells/Owner",
  component: OwnerShellFrame,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/dashboard">
        <Story />
      </ShellStory>
    ),
  ],
  args: {
    tenants: TENANTS,
    currentTenant: CURRENT_TENANT,
    userName: "สมชาย ทดสอบ",
    roleLabel: "เจ้าของ",
    groups: OWNER_GROUPS,
    bottomNav,
    buildings: BUILDINGS,
    currentBuildingId: null,
    envBadge: "uat",
    localePrefix: "",
    loginHref: "/login",
    children: (
      <div className="px-4 py-6 md:px-8">
        <h1 className="text-2xl font-semibold">เช้านี้</h1>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="รอตรวจสลิป" value="3" icon={IconBill} />
          <Stat label="บิลเลยกำหนด" value="5" icon={IconClock} />
          <Stat label="ห้องว่าง" value="2" icon={IconRoom} />
        </div>
      </div>
    ),
  },
};
export default meta;
type Story = StoryObj<typeof OwnerShellFrame>;

export const Desktop: Story = {};

export const SingleTenant: Story = {
  args: { tenants: [TENANTS[0]!], buildings: [BUILDINGS[0]!], envBadge: undefined },
};

export const ReadOnly: Story = {
  args: {
    banner: (
      <div className="px-4 pt-4">
        <Callout tone="warning" title="บัญชีอยู่ในโหมดอ่านอย่างเดียว">
          การสมัครใช้งานถูกระงับ ดูและส่งออกข้อมูลได้ แต่แก้ไขหรือออกบิลไม่ได้จนกว่าจะชำระค่าบริการ (D-082)
        </Callout>
      </div>
    ),
  },
};

export const Phone: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
