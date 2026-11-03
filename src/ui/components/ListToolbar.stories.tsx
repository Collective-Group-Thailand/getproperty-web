import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Input } from "./Input";
import { FilterLinks, ListToolbar, ViewTabs } from "./ListToolbar";
import { NativeSelect } from "./NativeSelect";

const meta: Meta<typeof ListToolbar> = { title: "Data/ListToolbar", component: ListToolbar };
export default meta;

export const Default: StoryObj<typeof ListToolbar> = {
  render: () => (
    <ListToolbar
      tabs={
        <ViewTabs
          label="มุมมอง"
          current="open"
          tabs={[
            { key: "open", href: "#open", label: "ค้างชำระ", count: 12 },
            { key: "overdue", href: "#overdue", label: "เลยกำหนด", count: 3 },
            { key: "paid", href: "#paid", label: "ชำระแล้ว", count: 48 },
          ]}
        />
      }
      search={<Input aria-label="ค้นหา" placeholder="ห้องหรือผู้เช่า" inputSize="sm" />}
      filters={
        <div className="w-40">
          <NativeSelect
            aria-label="อาคาร"
            inputSize="sm"
            placeholder="ทุกอาคาร"
            options={[
              { value: "a", label: "อาคาร A" },
              { value: "b", label: "อาคาร B" },
            ]}
          />
        </div>
      }
      actions={
        <Button variant="secondary" size="sm">
          ส่งออก
        </Button>
      }
    />
  ),
};

export const Links: StoryObj<typeof ListToolbar> = {
  render: () => (
    <FilterLinks
      label="ช่วงเวลา"
      current="week"
      links={[
        { key: "today", href: "#today", label: "วันนี้" },
        { key: "week", href: "#week", label: "สัปดาห์นี้" },
        { key: "all", href: "#all", label: "ทั้งหมด" },
      ]}
    />
  ),
};
