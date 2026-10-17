import type { Meta, StoryObj } from "@storybook/react-vite";

import { CameraCapture } from "./CameraCapture";

const meta: Meta<typeof CameraCapture> = {
  title: "Patterns/CameraCapture",
  component: CameraCapture,
  args: {
    label: "ถ่ายรูปมิเตอร์",
    hint: "ให้ตัวเลขอยู่ในกรอบ ระบบจะอ่านเลขให้",
    onCapture: () => undefined,
    labels: {
      viewfinder: "กล้อง",
      torchOn: "เปิดไฟฉาย",
      torchOff: "ปิดไฟฉาย",
      done: (count) => `ใช้ ${count} รูป`,
      remove: (index) => `ลบรูปที่ ${index}`,
      taken: (count) => `ถ่ายแล้ว ${count} รูป`,
      chooseFile: "เลือกรูปจากเครื่อง",
      starting: "กำลังเปิดกล้อง…",
      unavailable: "เปิดกล้องไม่ได้ เลือกรูปจากเครื่องแทน",
    },
  },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof CameraCapture>;

/** In Storybook without a camera this shows the fallback; on a phone the live view and the guide frame. */
export const Meter: Story = { render: (args) => <div className="max-w-sm">{<CameraCapture {...args} />}</div> };
export const MultiShot: Story = {
  render: (args) => <div className="max-w-sm">{<CameraCapture {...args} multiple guide="document" />}</div>,
};
