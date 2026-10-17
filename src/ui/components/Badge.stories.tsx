import type { Meta, StoryObj } from "@storybook/react-vite";

import { READING_SOURCE } from "@/domain/status";

import { Badge, StatusBadge } from "./Badge";
import { IconAlert } from "../icons/glyphs/alert";
import { IconBill } from "../icons/glyphs/bill";
import { IconCheckCircle } from "../icons/glyphs/check-circle";
import { IconClock } from "../icons/glyphs/clock";
import { IconInfo } from "../icons/glyphs/info";

const meta: Meta<typeof Badge> = {
  title: "Foundations/Badge",
  component: Badge,
  args: { children: "รอตรวจสลิป", tone: "warning", icon: IconClock },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">ร่าง</Badge>
      <Badge tone="primary" icon={IconBill}>
        ออกบิลแล้ว
      </Badge>
      <Badge tone="success" icon={IconCheckCircle}>
        จ่ายแล้ว
      </Badge>
      <Badge tone="warning" icon={IconClock}>
        ครบกำหนดใน 3 วัน
      </Badge>
      <Badge tone="danger" icon={IconAlert}>
        ค้างชำระ
      </Badge>
      <Badge tone="info" icon={IconInfo}>
        ประมาณการ
      </Badge>
    </div>
  ),
};
export const Status: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status={READING_SOURCE.iot} label="IoT" />
      <StatusBadge status={READING_SOURCE.ocr} label="ถ่ายรูป" />
      <StatusBadge status={READING_SOURCE.manual} label="จดเอง" />
      <StatusBadge status={READING_SOURCE.estimated} label="ประมาณการ" />
    </div>
  ),
};
