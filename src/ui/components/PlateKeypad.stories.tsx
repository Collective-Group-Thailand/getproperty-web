import type { Meta, StoryObj } from "@storybook/react-vite";

import { PlateKeypad } from "./PlateKeypad";

const meta: Meta<typeof PlateKeypad> = {
  title: "Gate/PlateKeypad",
  component: PlateKeypad,
  args: {
    groups: [
      { key: "mid", label: "อักษรกลาง", letters: ["ก", "จ", "ฎ", "ฏ", "ด", "ต", "บ", "ป", "อ"] },
      { key: "high", label: "อักษรสูง", letters: ["ข", "ฉ", "ฐ", "ถ", "ผ", "ฝ", "ศ", "ษ", "ส", "ห"] },
      {
        key: "lowPaired",
        label: "อักษรต่ำคู่",
        letters: ["ค", "ฆ", "ช", "ซ", "ฌ", "ฑ", "ฒ", "ท", "ธ", "พ", "ฟ", "ภ", "ฮ"],
      },
      { key: "lowSingle", label: "อักษรต่ำเดี่ยว", letters: ["ง", "ญ", "ณ", "น", "ม", "ย", "ร", "ล", "ว", "ฬ"] },
    ],
    labels: { letters: "พยัญชนะ", digits: "ตัวเลข", backspace: "ลบ", next: "ถัดไป", done: "เสร็จ" },
    onKey: () => {},
    onBackspace: () => {},
    onNext: () => {},
    onDone: () => {},
  },
  parameters: { layout: "padded" },
};
export default meta;

export const Letters: StoryObj<typeof PlateKeypad> = {};
/** Typing the number: the letters step back (they still work — a letter returns to the category). */
export const Digits: StoryObj<typeof PlateKeypad> = { args: { emphasis: "digits" } };
