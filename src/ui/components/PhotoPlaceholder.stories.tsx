import type { Meta, StoryObj } from "@storybook/react-vite";

import { PhotoPlaceholder } from "./PhotoPlaceholder";

const meta: Meta<typeof PhotoPlaceholder> = {
  title: "Media/PhotoPlaceholder",
  component: PhotoPlaceholder,
  args: { className: "rounded-panel aspect-[4/3] w-80" },
};
export default meta;
type Story = StoryObj<typeof PhotoPlaceholder>;

export const Decorative: Story = {};
export const Labelled: Story = { args: { label: "ยังไม่มีรูปห้องนี้" } };
