import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconBellRing } from "../icons/glyphs/bell-ring";
import { IconCheckCircle } from "../icons/glyphs/check-circle";
import { KioskAvatar, KioskButton, KioskChip, KioskInput, KioskNote, KioskStatusLine } from "./Kiosk";

const meta: Meta<typeof KioskButton> = {
  title: "Gate/Kiosk controls",
  component: KioskButton,
  parameters: { layout: "padded" },
};
export default meta;

export const Buttons: StoryObj<typeof KioskButton> = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <KioskButton size="xl" className="h-16" iconStart={IconBellRing}>
        แจ้งเจ้าของบ้าน
      </KioskButton>
      <KioskButton variant="secondary" size="xl" className="h-16">
        สแกน QR เชิญ
      </KioskButton>
      <KioskButton variant="destructive" size="xl" className="h-16">
        แจ้งเหตุ / SOS
      </KioskButton>
      <KioskButton loading>บันทึก</KioskButton>
    </div>
  ),
};

export const Field: StoryObj<typeof KioskButton> = {
  render: () => <KioskInput aria-label="ชื่อผู้มาติดต่อ" className="h-14" defaultValue="คุณอนันต์" />,
};

export const Notes: StoryObj<typeof KioskButton> = {
  render: () => (
    <div className="flex flex-col gap-3">
      <KioskNote tone="success" icon={IconCheckCircle} title="ให้เข้าได้เลย · บ้าน 99/11 ได้รับแจ้ง" />
      <KioskNote tone="info" icon={IconCheckCircle}>
        ส่งถึงบ้าน 99/11 แล้ว · รอตอบ
      </KioskNote>
    </div>
  ),
};

export const Chips: StoryObj<typeof KioskButton> = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <KioskChip tone="success" size="lg">
        ออนไลน์
      </KioskChip>
      <KioskChip tone="warning" size="lg">
        ออฟไลน์ · จะส่งเมื่อกลับมาออนไลน์ (3)
      </KioskChip>
      <KioskAvatar name="สมชาย ใจดี" />
      <KioskStatusLine tone="warning" icon={IconCheckCircle}>
        อยู่นานเกินกำหนด
      </KioskStatusLine>
    </div>
  ),
};
