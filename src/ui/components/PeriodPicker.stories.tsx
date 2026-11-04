import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { PeriodPicker } from "./PeriodPicker";

const meta: Meta<typeof PeriodPicker> = { title: "Forms/PeriodPicker", component: PeriodPicker };
export default meta;

function Demo() {
  const [value, setValue] = useState("2026-10");
  return (
    <PeriodPicker
      periods={["2026-11", "2026-10", "2026-09", "2026-08"]}
      value={value}
      onChange={setValue}
      locale="th"
      label="รอบบิล"
      previousLabel="รอบก่อน"
      nextLabel="รอบถัดไป"
    />
  );
}
export const Default: StoryObj<typeof PeriodPicker> = { render: () => <Demo /> };

function FilterDemo() {
  const [value, setValue] = useState("");
  return (
    <PeriodPicker
      periods={["2026-11", "2026-10", "2026-09", "2026-08"]}
      value={value}
      onChange={setValue}
      locale="th"
      label="เดือน"
      previousLabel="เดือนก่อน"
      nextLabel="เดือนถัดไป"
      allLabel="ทุกเดือน"
    />
  );
}
/** A list filter: the first choice shows every month. */
export const AsListFilter: StoryObj<typeof PeriodPicker> = { render: () => <FilterDemo /> };
