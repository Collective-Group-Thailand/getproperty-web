import type { Meta, StoryObj } from "@storybook/react-vite";

import { Stepper } from "./Stepper";

const steps = [
  { id: "scan", label: "สแกนมิเตอร์" },
  { id: "point", label: "เลือกจุดมิเตอร์" },
  { id: "wiring", label: "การเดินสาย" },
  { id: "reading", label: "เลขเริ่มต้น" },
  { id: "done", label: "ทดสอบไฟ" },
];

const meta: Meta<typeof Stepper> = {
  title: "Navigation/Stepper",
  component: Stepper,
  args: { steps, current: 2, label: "ขั้นตอนติดตั้ง", progressText: "ขั้นที่ 3 จาก 5" },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Stepper>;

export const Middle: Story = {};
export const First: Story = { args: { current: 0, progressText: "ขั้นที่ 1 จาก 5" } };
export const Last: Story = { args: { current: 4, progressText: "ขั้นที่ 5 จาก 5" } };
/** The phone wizard of the staff app: named segments, the current step's name as the title. */
export const Bar: Story = { args: { variant: "bar" }, parameters: { viewport: { defaultViewport: "mobile1" } } };

/** A short approval workflow with every step named under its dot (admin tariffs: entered → checked → published). */
export const Labelled: Story = {
  args: {
    labelled: true,
    current: 0,
    progressText: "ขั้นที่ 1 จาก 3",
    steps: [
      { id: "entered", label: "บันทึกแล้ว" },
      { id: "verified", label: "อีกคนตรวจแล้ว" },
      { id: "published", label: "เผยแพร่แล้ว" },
    ],
  },
};
