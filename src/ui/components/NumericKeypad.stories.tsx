import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { NumericKeypad } from "./NumericKeypad";

const meta: Meta<typeof NumericKeypad> = {
  title: "Forms/NumericKeypad",
  component: NumericKeypad,
  args: {
    label: "เลขมิเตอร์ที่อ่านได้",
    unit: "kWh",
    labels: { backspace: "ลบ", decimal: "จุดทศนิยม" },
    maxDecimals: 3,
    value: "",
  },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof NumericKeypad>;

function Demo(args: React.ComponentProps<typeof NumericKeypad>) {
  const [value, setValue] = useState(args.value);
  return (
    <div className="max-w-sm">
      <NumericKeypad {...args} value={value} onChange={setValue} />
    </div>
  );
}

export const Empty: Story = { render: (args) => <Demo {...args} /> };
export const Typed: Story = {
  render: (args) => <Demo {...args} value="12345.6" hint="ครั้งก่อน 12,300.000 kWh (1 ต.ค. 2569)" />,
};
export const WithError: Story = {
  render: (args) => <Demo {...args} value="12" error="ค่าที่จดต่ำกว่าครั้งก่อน ระบบจะส่งให้เจ้าของตรวจ" />,
};
export const Water: Story = { render: (args) => <Demo {...args} unit="m³" label="เลขมิเตอร์น้ำ" /> };
