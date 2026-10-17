import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconCamera } from "../icons/glyphs/camera";
import { IconGateway } from "../icons/glyphs/gateway";
import { IconMeter } from "../icons/glyphs/meter";
import { BigActionButton } from "./BigActionButton";

const meta: Meta<typeof BigActionButton> = {
  title: "Foundations/BigActionButton",
  component: BigActionButton,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof BigActionButton>;

export const Tasks: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <BigActionButton
        href="#readings"
        tone="primary"
        icon={IconMeter}
        title="จดมิเตอร์"
        description="ก่อนตัดรอบ 25 ต.ค. 2569"
        count={12}
      />
      <BigActionButton href="#inspections" icon={IconCamera} title="ตรวจห้อง" description="ย้ายออก A-305" count={1} />
      <BigActionButton icon={IconGateway} title="ติดตั้งอุปกรณ์" description="เกตเวย์รอเปิดใช้ 1 ตัว" />
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <div className="max-w-md">
      <BigActionButton icon={IconGateway} title="ติดตั้งอุปกรณ์" description="ไม่มีงานวันนี้" disabled />
    </div>
  ),
};
