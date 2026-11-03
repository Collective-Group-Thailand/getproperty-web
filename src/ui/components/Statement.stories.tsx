import type { Meta, StoryObj } from "@storybook/react-vite";

import { Statement } from "./Statement";

const meta: Meta<typeof Statement> = {
  title: "Data/Statement",
  component: Statement,
  args: {
    caption: "งบรายได้ ต.ค. 2569",
    lines: [
      { key: "h1", label: "รายได้", kind: "heading" },
      { key: "rent", label: "ค่าเช่า", value: "฿186,000.00", level: 1 },
      { key: "util", label: "ค่าน้ำค่าไฟ", value: "฿24,310.00", level: 1 },
      { key: "income", label: "รวมรายได้", value: "฿210,310.00", kind: "subtotal" },
      { key: "h2", label: "ค่าใช้จ่าย", kind: "heading" },
      { key: "repairs", label: "ค่าซ่อม", value: "(฿8,200.00)", level: 1 },
      { key: "net", label: "รายได้สุทธิ", value: "฿202,110.00", kind: "result" },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof Statement> = {};
