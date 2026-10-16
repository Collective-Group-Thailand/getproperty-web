import type { Meta, StoryObj } from "@storybook/react-vite";

import { Timeline } from "./Timeline";

const meta: Meta<typeof Timeline> = {
  title: "Data/Timeline",
  component: Timeline,
  args: {
    events: [
      {
        id: "1",
        title: "ชำระแล้ว ฿4,850.50",
        time: "2 ชม. ที่แล้ว",
        timeTitle: "17 ก.ย. 2569 09:42",
        actor: "ธนาคารยืนยันอัตโนมัติ",
        icon: "check-circle",
        tone: "success",
      },
      {
        id: "2",
        title: "ส่งบิลทาง LINE",
        time: "เมื่อวาน",
        timeTitle: "16 ก.ย. 2569 08:00",
        actor: "ระบบ",
        icon: "chat",
        tone: "primary",
      },
      {
        id: "3",
        title: "ออกบิล",
        time: "เมื่อวาน",
        timeTitle: "16 ก.ย. 2569 07:58",
        actor: "คุณสมศรี (เจ้าของ)",
        description: "ไฟ 04521.3 → 04612.8 kWh · น้ำ 00318 → 00325 m³",
        icon: "bill",
      },
      {
        id: "4",
        title: "จดเลขมิเตอร์",
        time: "2 วันที่แล้ว",
        timeTitle: "15 ก.ย. 2569 10:12",
        actor: "คุณวิชัย (เจ้าหน้าที่)",
        icon: "camera",
        tone: "neutral",
        evidence: <div aria-hidden="true" className="bg-bg-subtle rounded-control size-16" />,
      },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof Timeline>;

export const BillHistory: Story = {};
