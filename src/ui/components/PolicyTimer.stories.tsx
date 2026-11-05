import type { Meta, StoryObj } from "@storybook/react-vite";

import { PolicyTimer } from "./PolicyTimer";

const meta: Meta<typeof PolicyTimer> = {
  title: "Gate/PolicyTimer",
  component: PolicyTimer,
  args: {
    label: "เวลาที่บ้านนี้ให้ตอบ",
    fraction: 0.4,
    elapsed: false,
    caption: "ครบ 3 นาที → ให้ รปภ. โทร",
    remaining: "เหลือ 1:48",
  },
  parameters: { layout: "padded" },
};
export default meta;

export const Running: StoryObj<typeof PolicyTimer> = {};
export const Elapsed: StoryObj<typeof PolicyTimer> = {
  args: { fraction: 1, elapsed: true, caption: "ครบเวลา · โทรหาเจ้าของบ้าน", remaining: undefined },
};
