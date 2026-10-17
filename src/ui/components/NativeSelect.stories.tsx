import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";
import { NativeSelect } from "./NativeSelect";

const meta: Meta<typeof NativeSelect> = {
  title: "Forms/NativeSelect",
  component: NativeSelect,
  args: {
    placeholder: "ทุกสถานะ",
    options: [
      { value: "issued", label: "ออกแล้ว" },
      { value: "overdue", label: "เกินกำหนด" },
      { value: "paid", label: "ชำระแล้ว" },
    ],
  },
  render: (args) => (
    <Field label="สถานะบิล">
      <NativeSelect {...args} />
    </Field>
  ),
};
export default meta;

type Story = StoryObj<typeof NativeSelect>;

export const Default: Story = {};
export const Small: Story = { args: { inputSize: "sm" } };
export const Dark: Story = { globals: { theme: "dark" } };
