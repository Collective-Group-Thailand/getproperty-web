import type { Meta, StoryObj } from "@storybook/react-vite";

import { FieldError } from "./FieldError";

const meta: Meta<typeof FieldError> = {
  title: "Forms/FieldError",
  component: FieldError,
  args: { children: "ใส่ตัวเลข 4 หลักพอดี" },
};
export default meta;

export const Default: StoryObj<typeof FieldError> = {};
