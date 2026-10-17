import type { Meta, StoryObj } from "@storybook/react-vite";

import { Chart } from "./Chart";

const months = ["พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค."];

const meta: Meta<typeof Chart> = {
  title: "Data/Chart",
  component: Chart,
  args: {
    type: "line",
    title: "หน่วยสูญหายรายเดือน",
    points: ["412.5", "380.0", null, "455.25", "390.75", "301.5"].map((value, index) => ({
      key: `2026-${index + 5}`,
      label: months[index]!,
      value,
    })),
    formatValue: (value: string) => `${value} kWh`,
    table: { summary: "ดูเป็นตาราง", label: "เดือน", value: "หน่วย" },
    emptyText: "ยังไม่มีข้อมูลช่วงนี้",
  },
};
export default meta;

type Story = StoryObj<typeof Chart>;

export const Line: Story = {};
export const Bar: Story = { args: { type: "bar" } };
export const Empty: Story = { args: { points: [] } };
export const Dark: Story = { globals: { theme: "dark" } };
