import type { Meta, StoryObj } from "@storybook/react-vite";

import { SignaturePad } from "./SignaturePad";

const meta: Meta<typeof SignaturePad> = {
  title: "Forms/SignaturePad",
  component: SignaturePad,
  args: {
    label: "ลายเซ็นผู้เช่า",
    labels: { placeholder: "เซ็นชื่อในกรอบ", clear: "ล้าง", undo: "ย้อนกลับ", upload: "ใช้รูปลายเซ็น" },
    onChange: () => undefined,
  },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof SignaturePad>;

export const Empty: Story = { render: (args) => <div className="max-w-md">{<SignaturePad {...args} />}</div> };
export const Disabled: Story = {
  render: (args) => <div className="max-w-md">{<SignaturePad {...args} disabled />}</div>,
};
