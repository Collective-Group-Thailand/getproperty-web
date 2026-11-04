import type { Meta, StoryObj } from "@storybook/react-vite";

import { StageRail } from "./StageRail";

const meta: Meta<typeof StageRail> = {
  title: "Data/StageRail",
  component: StageRail,
  args: {
    label: "ขั้นของรอบบิล",
    current: 1,
    stages: [
      { key: "open", label: "เปิดรอบ" },
      { key: "readings_pending", label: "จดมิเตอร์", detail: "ตัดรอบ 30 พ.ย. 2569 23:59" },
      { key: "computed", label: "ตรวจร่าง" },
      { key: "issued", label: "ออกบิลแล้ว" },
      { key: "closed", label: "ปิดรอบ" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof StageRail> = {};
