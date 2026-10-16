import type { Meta, StoryObj } from "@storybook/react-vite";

import { MoneyDisplay } from "./MoneyDisplay";

const meta: Meta<typeof MoneyDisplay> = {
  title: "Data/MoneyDisplay",
  component: MoneyDisplay,
  args: { amount: "4850.50" },
};
export default meta;
type Story = StoryObj<typeof MoneyDisplay>;

export const Default: Story = {};
export const Hero: Story = { args: { size: "hero" } };
export const Tones: Story = {
  render: () => (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt>จ่ายแล้ว</dt>
      <dd className="text-end">
        <MoneyDisplay amount="4850.50" tone="success" />
      </dd>
      <dt>ครบกำหนดใน 3 วัน</dt>
      <dd className="text-end">
        <MoneyDisplay amount="4850.50" tone="attention" />
      </dd>
      <dt>ค้างชำระ 12 วัน</dt>
      <dd className="text-end">
        <MoneyDisplay amount="4850.50" tone="danger" />
      </dd>
      <dt>ค่าน้ำ (รวมแล้ว)</dt>
      <dd className="text-end">
        <MoneyDisplay amount="-120.00" tone="muted" />
      </dd>
    </dl>
  ),
};
export const Malformed: Story = { args: { amount: "n/a" } };
