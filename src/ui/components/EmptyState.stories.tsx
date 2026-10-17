import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { IconRoom } from "../icons/glyphs/room";
import { IconUpload } from "../icons/glyphs/upload";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  args: {
    icon: IconRoom,
    title: "ยังไม่มีห้อง",
    description: "เพิ่มห้องจาก Excel ใน 1 นาที หรือเพิ่มทีละห้อง",
    action: <Button iconStart={IconUpload}>นำเข้าจาก Excel</Button>,
  },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};
