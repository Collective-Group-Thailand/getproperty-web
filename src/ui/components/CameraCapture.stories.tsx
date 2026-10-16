import type { Meta, StoryObj } from "@storybook/react-vite";

import { CameraCapture, ScanButton } from "./CameraCapture";

const meta: Meta<typeof CameraCapture> = {
  title: "Patterns/CameraCapture",
  component: CameraCapture,
  args: { label: "ถ่ายรูปมิเตอร์", hint: "ให้ตัวเลขอยู่ในกรอบ ระบบจะอ่านเลขให้" },
};
export default meta;
type Story = StoryObj<typeof CameraCapture>;

export const Capture: Story = {};
export const Scan: Story = { render: () => <ScanButton label="สแกน QR อุปกรณ์" onScan={() => undefined} /> };
