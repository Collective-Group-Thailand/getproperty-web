import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field, FormSection } from "./Field";
import { Input, NumberInput, Textarea } from "./Input";

const meta: Meta<typeof Field> = {
  title: "Forms/Field",
  component: Field,
  args: { label: "ชื่อห้อง", hint: "เช่น A-301" },
};
export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <Input placeholder="A-301" />
    </Field>
  ),
};
export const Required: Story = {
  render: (args) => (
    <Field {...args} required requiredLabel="จำเป็น">
      <Input />
    </Field>
  ),
};
export const WithError: Story = {
  render: (args) => (
    <Field {...args} error="กรุณากรอกชื่อห้อง">
      <Input defaultValue="" />
    </Field>
  ),
};
export const Disabled: Story = {
  render: (args) => (
    <Field {...args} disabled>
      <Input defaultValue="A-301" />
    </Field>
  ),
};
export const WithUnit: Story = {
  render: () => (
    <Field label="เลขมิเตอร์ไฟ" hint="อ่านจากหน้าปัด 5 หลัก">
      <NumberInput unit="kWh" defaultValue="04521.3" />
    </Field>
  ),
};
export const TextareaField: Story = {
  render: () => (
    <Field label="หมายเหตุ">
      <Textarea defaultValue="มิเตอร์อยู่หลังประตูชั้น 3" />
    </Field>
  ),
};
export const Section: Story = {
  render: () => (
    <FormSection title="ข้อมูลห้อง" description="ชื่อห้องและชั้นที่ผู้เช่าจะเห็นในบิล">
      <Field label="ชื่อห้อง">
        <Input defaultValue="A-301" />
      </Field>
      <Field label="ชั้น">
        <NumberInput defaultValue="3" />
      </Field>
    </FormSection>
  ),
};
