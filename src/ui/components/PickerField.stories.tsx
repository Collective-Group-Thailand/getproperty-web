import type { Meta, StoryObj } from "@storybook/react-vite";

import { PickerField } from "./PickerField";

const meta: Meta<typeof PickerField> = {
  title: "Forms/PickerField",
  component: PickerField,
  args: { children: "ค้นหาบ้านเลขที่ หรือเลือกซอย", "aria-label": "บ้านปลายทาง" },
  parameters: { layout: "padded" },
};
export default meta;

export const Empty: StoryObj<typeof PickerField> = {};
export const Filled: StoryObj<typeof PickerField> = { args: { filled: true, children: "99/11 · ซอย 1" } };
export const Invalid: StoryObj<typeof PickerField> = { args: { invalid: true } };
