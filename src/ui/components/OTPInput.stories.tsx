import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";
import { OTPInput } from "./OTPInput";

const meta: Meta<typeof OTPInput> = {
  title: "Forms/OTPInput",
  component: OTPInput,
  args: { length: 6, value: "", digitLabel: (i) => `หลักที่ ${i + 1}` },
};
export default meta;
type Story = StoryObj<typeof OTPInput>;

function Demo(args: React.ComponentProps<typeof OTPInput>) {
  const [value, setValue] = useState(args.value);
  return (
    <Field label="รหัส OTP" hint="ส่งไปที่ 081-234-5678 — วางรหัสจาก SMS ได้เลย">
      <OTPInput {...args} value={value} onChange={setValue} />
    </Field>
  );
}

export const Empty: Story = { render: (args) => <Demo {...args} /> };
export const Filled: Story = { render: (args) => <Demo {...args} value="482913" /> };
export const Four: Story = { render: (args) => <Demo {...args} length={4} /> };
