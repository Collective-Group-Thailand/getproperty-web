import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorSummary } from "./ErrorSummary";

const meta: Meta<typeof ErrorSummary> = {
  title: "Forms/ErrorSummary",
  component: ErrorSummary,
  args: {
    title: "แก้ไข 2 รายการก่อนไปต่อ",
    items: [
      { fieldId: "buyer-1-name", message: "ผู้ซื้อคนที่ 1: กรอกชื่อ" },
      { fieldId: "buyer-shares", message: "สัดส่วนผู้ซื้อรวมกันเกิน 100%" },
    ],
  },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <ErrorSummary {...args} />
      <label htmlFor="buyer-1-name" className="text-sm">
        ชื่อผู้ซื้อ
      </label>
      <input id="buyer-1-name" className="border-border rounded-control border px-3 py-2" />
      <label htmlFor="buyer-shares" className="text-sm">
        สัดส่วน
      </label>
      <input id="buyer-shares" className="border-border rounded-control border px-3 py-2" />
    </div>
  ),
};
export default meta;
export const Default: StoryObj<typeof ErrorSummary> = {};
