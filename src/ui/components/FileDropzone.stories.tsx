import type { Meta, StoryObj } from "@storybook/react-vite";

import { FileDropzone } from "./FileDropzone";

const meta: Meta<typeof FileDropzone> = {
  title: "Forms/FileDropzone",
  component: FileDropzone,
  args: {
    label: "แนบไฟล์ Excel รายชื่อห้อง",
    hint: "ไฟล์ .xlsx ตามแบบฟอร์ม ไม่เกิน 5 MB",
    accept: ".xlsx",
    chooseText: "เลือกไฟล์",
    maxBytes: 5 * 1024 * 1024,
    tooLargeText: "ไฟล์ใหญ่เกิน 5 MB",
    onFiles: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof FileDropzone>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Dark: Story = { globals: { theme: "dark" } };
