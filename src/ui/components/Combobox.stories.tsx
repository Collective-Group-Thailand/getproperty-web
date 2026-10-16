import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Combobox } from "./Combobox";
import { Field } from "./Field";

const ROOMS = [
  { value: "a301", label: "A-301", description: "ชั้น 3 · คุณสมชาย" },
  { value: "a302", label: "A-302", description: "ชั้น 3 · ว่าง" },
  { value: "b101", label: "B-101", description: "ชั้น 1 · คุณมาลี" },
  { value: "b205", label: "B-205", description: "ชั้น 2 · คุณอนันต์" },
];

const meta: Meta<typeof Combobox> = {
  title: "Forms/Combobox",
  component: Combobox,
  args: {
    options: ROOMS,
    placeholder: "พิมพ์เลขห้องหรือชื่อผู้เช่า",
    emptyLabel: "ไม่พบห้อง",
    listLabel: "ห้อง",
    value: null,
  },
};
export default meta;
type Story = StoryObj<typeof Combobox>;

function Demo(args: React.ComponentProps<typeof Combobox>) {
  const [value, setValue] = useState<string | null>(args.value);
  return (
    <Field label="ห้อง">
      <Combobox {...args} value={value} onChange={setValue} />
    </Field>
  );
}

export const Default: Story = { render: (args) => <Demo {...args} /> };
export const Selected: Story = { render: (args) => <Demo {...args} value="b101" /> };
