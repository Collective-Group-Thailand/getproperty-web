import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Foundations/Button",
  component: Button,
  args: { children: "ออกบิลเดือนนี้" },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "ดูรายละเอียด" } };
export const Ghost: Story = { args: { variant: "ghost", children: "ยกเลิก" } };
export const Destructive: Story = { args: { variant: "destructive", children: "ยกเลิกบิล" } };
export const Link: Story = { args: { variant: "link", children: "ค่า Ft คืออะไร?" } };
export const WithIcon: Story = { args: { iconStart: "add", children: "เพิ่มห้อง" } };
export const Loading: Story = { args: { loading: true, children: "กำลังบันทึก…" } };
export const Disabled: Story = { args: { disabled: true } };
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        เล็ก
      </Button>
      <Button {...args} size="md">
        ปกติ
      </Button>
      <Button {...args} size="lg">
        ใหญ่
      </Button>
      <Button {...args} size="xl">
        เจ้าหน้าที่ 48 px
      </Button>
    </div>
  ),
};
