import type { Meta, StoryObj } from "@storybook/react-vite";

import { PlateBoxes } from "./PlateBoxes";

const labels = { category: "หมวดอักษร", number: "เลขทะเบียน", province: "จังหวัด", provinceEmpty: "เลือกจังหวัด" };

const meta: Meta<typeof PlateBoxes> = {
  title: "Gate/PlateBoxes",
  component: PlateBoxes,
  args: {
    idPrefix: "story",
    category: "",
    number: "",
    province: "",
    active: null,
    labels,
    onSelect: () => {},
    placeholders: { category: "1กข", number: "1234" },
  },
  parameters: { layout: "padded" },
};
export default meta;

export const Empty: StoryObj<typeof PlateBoxes> = {};
export const Typing: StoryObj<typeof PlateBoxes> = { args: { category: "1กข", number: "45", active: "number" } };
export const Filled: StoryObj<typeof PlateBoxes> = {
  args: { category: "3กท", number: "8812", province: "กรุงเทพมหานคร" },
};
export const WithErrors: StoryObj<typeof PlateBoxes> = {
  args: {
    category: "12",
    errors: {
      category: "หมวดอักษร 1–4 ตัว มีพยัญชนะอย่างน้อย 1 ตัว",
      number: "เลขทะเบียน 1–4 หลัก",
      province: "เลือกจังหวัดตามป้าย",
    },
  },
};
