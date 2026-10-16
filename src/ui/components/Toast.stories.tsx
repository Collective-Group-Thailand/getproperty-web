import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { toast, Toaster } from "./Toast";

const meta: Meta<typeof Toaster> = { title: "Feedback/Toast", component: Toaster };
export default meta;
type Story = StoryObj<typeof Toaster>;

export const Demo: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button
        variant="secondary"
        onClick={() => toast.success("บันทึกเลขมิเตอร์แล้ว", { description: "A-301 · 04521.3 kWh" })}
      >
        สำเร็จ
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast("ย้ายห้อง A-301 ไปชั้น 4 แล้ว", { action: { label: "เลิกทำ", onClick: () => undefined } })}
      >
        พร้อมเลิกทำ
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.error("ส่ง LINE ไม่สำเร็จ", { description: "ผู้เช่ายังไม่ได้ผูก LINE" })}
      >
        ผิดพลาด
      </Button>
    </div>
  ),
};
