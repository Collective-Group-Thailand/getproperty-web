import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { ErrorState } from "./ErrorState";

const meta: Meta<typeof ErrorState> = {
  title: "Feedback/ErrorState",
  component: ErrorState,
  args: {
    title: "โหลดบิลไม่สำเร็จ",
    description: "เชื่อมต่อไม่ได้ชั่วคราว ลองอีกครั้งหรือกลับมาในอีกสักครู่",
    requestId: "req_01J9X7K2M4",
    requestIdLabel: "รหัสคำขอ",
    action: (
      <Button variant="secondary" iconStart="refresh">
        ลองอีกครั้ง
      </Button>
    ),
  },
};
export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {};
