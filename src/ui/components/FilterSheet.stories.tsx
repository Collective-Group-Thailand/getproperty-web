import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./Checkbox";
import { Field } from "./Field";
import { FilterSheet } from "./FilterSheet";
import { Input } from "./Input";
import { ViewTabs } from "./ListToolbar";
import { NativeSelect } from "./NativeSelect";

const meta: Meta<typeof FilterSheet> = {
  title: "Data/FilterSheet",
  component: FilterSheet,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export default meta;
type Story = StoryObj<typeof FilterSheet>;

/** A console list on a phone: chips for the views, the search, and the rest behind one trigger. */
export const ConsoleList: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-3">
      <ViewTabs
        label="มุมมอง"
        current="open"
        tabs={[
          { key: "open", href: "#open", label: "ค้างชำระ", count: 12 },
          { key: "overdue", href: "#overdue", label: "เลยกำหนด", count: 3 },
          { key: "paid", href: "#paid", label: "ชำระแล้ว", count: 48 },
        ]}
      />
      <div className="flex items-center gap-2">
        <Input aria-label="ค้นหา" placeholder="เลขที่ ห้อง หรือผู้เช่า" className="flex-1" />
        <FilterSheet
          label="ตัวกรอง"
          count={2}
          closeLabel="ปิด"
          applyLabel="ดูผลลัพธ์"
          clear={{ href: "#", label: "ล้างตัวกรอง" }}
        >
          <Field label="อาคาร">
            <NativeSelect
              options={[
                { value: "", label: "ทุกอาคาร" },
                { value: "a", label: "อาคาร A" },
              ]}
            />
          </Field>
          <Field label="รอบบิล">
            <NativeSelect
              options={[
                { value: "", label: "ทุกรอบบิล" },
                { value: "2026-11", label: "พ.ย. 2569" },
              ]}
            />
          </Field>
        </FilterSheet>
      </div>
    </div>
  ),
};

/** A public GET search: the sheet is its own form and carries the rest of the query. */
export const PublicSearch: Story = {
  render: () => (
    <FilterSheet
      label="ตัวกรอง"
      trigger="button"
      closeLabel="ปิด"
      applyLabel="ดูผลลัพธ์"
      form={{ action: "#", hidden: { q: "อารีย์" } }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="ค่าเช่าต่ำสุด">
          <Input name="minRent" inputMode="numeric" />
        </Field>
        <Field label="ค่าเช่าสูงสุด">
          <Input name="maxRent" inputMode="numeric" />
        </Field>
      </div>
      <Checkbox name="pets" value="1" label="เลี้ยงสัตว์ได้" />
    </FilterSheet>
  ),
};
