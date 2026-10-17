import type { Meta, StoryObj } from "@storybook/react-vite";

import { ScanButton } from "./ScanButton";

const meta: Meta<typeof ScanButton> = {
  title: "Forms/ScanButton",
  component: ScanButton,
  args: {
    label: "สแกน QR อุปกรณ์",
    onScan: () => undefined,
    labels: {
      viewfinder: "กล้องสแกน",
      aim: "เล็งกล้องไปที่ QR บนฉลาก",
      manualLabel: "หมายเลขเครื่อง (Serial)",
      manualSubmit: "ใช้หมายเลขนี้",
      cancel: "ยกเลิก",
      starting: "กำลังเปิดกล้อง…",
      unsupported: "เครื่องนี้อ่าน QR ไม่ได้ พิมพ์หมายเลขเครื่องแทน",
    },
  },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ScanButton>;

export const Closed: Story = { render: (args) => <div className="max-w-md">{<ScanButton {...args} />}</div> };
