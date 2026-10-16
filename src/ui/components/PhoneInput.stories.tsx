import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";
import { PhoneInput, toE164 } from "./PhoneInput";

const meta: Meta<typeof PhoneInput> = {
  title: "Forms/PhoneInput",
  component: PhoneInput,
  args: { value: "" },
};
export default meta;
type Story = StoryObj<typeof PhoneInput>;

function Demo(args: React.ComponentProps<typeof PhoneInput>) {
  const [value, setValue] = useState(args.value);
  return (
    <Field label="เบอร์โทรศัพท์" hint="ใช้รับรหัส OTP">
      <PhoneInput {...args} value={value} onChange={setValue} />
      <p className="text-muted font-mono text-xs">{toE164(value) ?? "—"}</p>
    </Field>
  );
}

export const Empty: Story = { render: (args) => <Demo {...args} /> };
export const Filled: Story = { render: (args) => <Demo {...args} value="0812345678" /> };
