import type { Meta, StoryObj } from "@storybook/react-vite";

import { StepTrack } from "./StepTrack";

const meta: Meta<typeof StepTrack> = {
  title: "Navigation/StepTrack",
  component: StepTrack,
  args: {
    label: "ขั้นตอนการนำเข้า",
    steps: [
      { key: "upload", label: "อัปโหลดไฟล์", line: "4 ไฟล์ · 312 แถว", status: "done", href: "#upload" },
      { key: "validate", label: "ตรวจสอบข้อมูล", line: "ผ่าน 248 แปลง", status: "done", href: "#validate" },
      { key: "reconcile", label: "กระทบยอด", line: "ต้องอธิบายส่วนต่าง", lineTone: "warning", status: "current" },
      { key: "commit", label: "ยืนยันนำเข้า", line: "ยังไม่ถึงขั้นนี้", status: "upcoming" },
      { key: "golive", label: "รอบคู่ขนานและเริ่มใช้งาน", line: "ยังไม่ถึงขั้นนี้", status: "upcoming" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-6xl p-6">
        <Story />
      </div>
    ),
  ],
};
export default meta;
export const Reconcile: StoryObj<typeof StepTrack> = {};
/** A done step reopened for reading. */
export const ReadingBack: StoryObj<typeof StepTrack> = { args: { selected: "validate" } };
