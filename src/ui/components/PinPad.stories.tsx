import type { Meta, StoryObj } from "@storybook/react-vite";

import { PinPad } from "./PinPad";

const meta: Meta<typeof PinPad> = {
  title: "Gate/PinPad",
  component: PinPad,
  args: {
    length: 2,
    maxLength: 6,
    onDigit: () => {},
    onBackspace: () => {},
    labels: { backspace: "ลบหนึ่งหลัก", entered: "ใส่แล้ว 2 หลัก" },
  },
  parameters: { layout: "centered" },
};
export default meta;

export const Typing: StoryObj<typeof PinPad> = {};
export const WrongPin: StoryObj<typeof PinPad> = {
  args: { length: 0, message: "PIN ไม่ถูกต้อง ลองอีกครั้ง", messageTone: "danger" },
};
/** The API's 423 `gate.pin_locked`: closed until `lockedUntil`. */
export const Locked: StoryObj<typeof PinPad> = {
  args: { length: 0, disabled: true, message: "ใส่ PIN ผิดหลายครั้ง ลองใหม่ได้ใน 14:32", messageTone: "warning" },
};
