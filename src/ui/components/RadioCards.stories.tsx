import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";
import { RadioCards } from "./RadioCards";
import { IconCamera } from "../icons/glyphs/camera";
import { IconEdit } from "../icons/glyphs/edit";
import { IconGateway } from "../icons/glyphs/gateway";
import { IconHelp } from "../icons/glyphs/help";

const meta: Meta<typeof RadioCards> = {
  title: "Forms/RadioCards",
  component: RadioCards,
  args: {
    defaultValue: "ocr",
    options: [
      { value: "iot", label: "มิเตอร์อัจฉริยะ", description: "อ่านอัตโนมัติทุกวัน", icon: IconGateway },
      { value: "ocr", label: "ถ่ายรูปมิเตอร์", description: "เจ้าหน้าที่ถ่าย ระบบอ่านเลขให้", icon: IconCamera },
      { value: "manual", label: "จดเอง", description: "พิมพ์เลขจากหน้าปัด", icon: IconEdit },
      {
        value: "estimated",
        label: "ประมาณการ",
        description: "ใช้เมื่ออ่านไม่ได้ จะปรับในรอบถัดไป",
        icon: IconHelp,
        disabled: true,
      },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof RadioCards>;

export const Default: Story = {
  render: (args) => (
    <Field label="ที่มาของเลขมิเตอร์">
      <RadioCards {...args} />
    </Field>
  ),
};
export const ThreeColumns: Story = {
  render: (args) => (
    <Field label="แพ็กเกจ">
      <RadioCards {...args} columns={3} />
    </Field>
  ),
};
