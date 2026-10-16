import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { DatePicker } from "./DatePicker";
import { Field } from "./Field";

const LABELS = {
  calendar: "ปฏิทิน",
  previousMonth: "เดือนก่อน",
  nextMonth: "เดือนถัดไป",
  today: "วันนี้",
  clear: "ล้าง",
};

const meta: Meta<typeof DatePicker> = {
  title: "Forms/DatePicker",
  component: DatePicker,
  args: { value: "2026-09-17", labels: LABELS, placeholder: "เลือกวันที่" },
};
export default meta;
type Story = StoryObj<typeof DatePicker>;

function Demo(args: React.ComponentProps<typeof DatePicker>) {
  const [value, setValue] = useState<string | null>(args.value);
  return (
    <Field label="วันเริ่มสัญญา" hint="แสดงเป็นปี พ.ศ. ส่งให้ระบบเป็น ISO">
      <DatePicker {...args} value={value} onChange={setValue} />
      <p className="text-muted font-mono text-xs">{value ?? "null"}</p>
    </Field>
  );
}

export const BuddhistEra: Story = { render: (args) => <Demo {...args} /> };
export const English: Story = {
  render: (args) => (
    <Demo
      {...args}
      locale="en"
      labels={{
        calendar: "Calendar",
        previousMonth: "Previous month",
        nextMonth: "Next month",
        today: "Today",
        clear: "Clear",
      }}
    />
  ),
};
export const Empty: Story = { render: (args) => <Demo {...args} value={null} /> };
