import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Forms/Select",
  component: Select,
  args: {
    placeholder: "เลือกอาคาร",
    options: [
      { value: "a", label: "อาคาร A — สุขุมวิท 101" },
      { value: "b", label: "อาคาร B — ลาดพร้าว 48" },
      { value: "c", label: "อาคาร C (ปิดปรับปรุง)", disabled: true },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: (args) => (
    <Field label="อาคาร">
      <Select {...args} />
    </Field>
  ),
};
export const Selected: Story = {
  render: (args) => (
    <Field label="อาคาร">
      <Select {...args} defaultValue="b" />
    </Field>
  ),
};
