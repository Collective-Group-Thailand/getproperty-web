import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  args: {
    icon: "room",
    title: "ยังไม่มีห้อง",
    description: "เพิ่มห้องจาก Excel ใน 1 นาที หรือเพิ่มทีละห้อง",
    action: <Button iconStart="upload">นำเข้าจาก Excel</Button>,
  },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};
