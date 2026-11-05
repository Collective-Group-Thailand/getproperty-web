import type { Meta, StoryObj } from "@storybook/react-vite";

import { PeriodStatement } from "./PeriodStatement";

const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const row = (n: number) =>
  months.map((_, index) => (index < 10 ? (n + index * 120).toLocaleString("en-US") + ".00" : "–"));

const meta: Meta<typeof PeriodStatement> = {
  title: "Data/PeriodStatement",
  component: PeriodStatement,
  args: {
    caption: "งบรายได้และค่าใช้จ่าย",
    accountHeader: "บัญชี",
    totalHeader: "รวม",
    periods: months,
    rows: [
      { key: "ih", kind: "heading", label: "รายได้", values: [] },
      { key: "i1", kind: "line", code: "4110", label: "รายได้ค่าส่วนกลาง", values: [...row(158400), "1,589,400.00"] },
      {
        key: "i2",
        kind: "line",
        code: "4130",
        label: "รายได้เงินเพิ่ม (ชำระล่าช้า)",
        values: [...row(820), "13,400.00"],
      },
      { key: "it", kind: "subtotal", label: "รวมรายได้", values: [...row(159220), "1,602,800.00"] },
      { key: "eh", kind: "heading", label: "ค่าใช้จ่าย", values: [] },
      { key: "e1", kind: "line", code: "5140", label: "ค่าจ้างบริการ", values: [...row(58500), "585,000.00"] },
      { key: "et", kind: "subtotal", label: "รวมค่าใช้จ่าย", values: [...row(126400), "1,264,000.00"] },
      { key: "s", kind: "result", label: "รายได้สูง (ต่ำ) กว่าค่าใช้จ่าย", values: [...row(32820), "338,800.00"] },
    ],
  },
};
export default meta;
export const Monthly: StoryObj<typeof PeriodStatement> = {};

/** By quarter: four columns and the total fit a phone without scrolling far. */
export const Quarterly: StoryObj<typeof PeriodStatement> = {
  args: {
    periods: ["ไตรมาส 1", "ไตรมาส 2", "ไตรมาส 3", "ไตรมาส 4"],
    rows: [
      { key: "ih", kind: "heading", label: "รายได้", values: [] },
      {
        key: "i1",
        kind: "line",
        code: "4110",
        label: "รายได้ค่าส่วนกลาง",
        values: ["475,200.00", "475,200.00", "475,200.00", "–", "1,425,600.00"],
      },
      {
        key: "s",
        kind: "result",
        label: "รายได้สูง (ต่ำ) กว่าค่าใช้จ่าย",
        values: ["(12,400.00)", "84,300.00", "96,100.00", "0.00", "168,000.00"],
      },
    ],
  },
};
