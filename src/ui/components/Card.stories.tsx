import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Card, CardHeader } from "./Card";

const meta: Meta<typeof Card> = { title: "Foundations/Card", component: Card };
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader
        title="เงินประกัน"
        description="คืนภายใน 7 วันหลังย้ายออก ตามประกาศ สคบ."
        action={
          <Button size="sm" variant="secondary">
            ดูทั้งหมด
          </Button>
        }
      />
      <p>฿12,000.00 · ครบกำหนดคืน 24 ก.ย. 2569</p>
    </Card>
  ),
};
export const Interactive: Story = {
  render: () => (
    <Card interactive as="article" className="max-w-md">
      <p className="font-medium">A-301</p>
      <p className="text-muted text-sm">คุณสมชาย · จ่ายแล้ว</p>
    </Card>
  ),
};
