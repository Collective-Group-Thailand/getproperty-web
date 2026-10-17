import type { Meta, StoryObj } from "@storybook/react-vite";

import { DescriptionList } from "./DescriptionList";

const meta: Meta<typeof DescriptionList> = {
  title: "Data/DescriptionList",
  component: DescriptionList,
  args: {
    items: [
      { id: "unit", term: "ห้อง", description: "A-201" },
      { id: "rent", term: "ค่าเช่า", description: <span className="tabular-nums">฿4,500.00</span> },
      { id: "start", term: "เริ่มสัญญา", description: "1 ต.ค. 2569" },
      { id: "end", term: "สิ้นสุด", description: null },
      {
        id: "address",
        term: "ที่อยู่",
        description: "99/1 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10000",
        wide: true,
      },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof DescriptionList>;

export const TwoColumns: Story = {};
export const ThreeColumns: Story = { args: { columns: 3 } };
export const Dark: Story = { globals: { theme: "dark" } };
