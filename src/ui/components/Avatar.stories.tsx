import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Foundations/Avatar",
  component: Avatar,
  args: { name: "สมชาย ทดสอบ" },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Thai: Story = {};
/** A Thai leading vowel is skipped: "เอก" shows อ. */
export const LeadingVowel: Story = { args: { name: "เอกชัย ใจดี" } };
export const Small: Story = { args: { name: "Ann Lee", size: "sm" } };
