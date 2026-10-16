import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { MoneyDisplay } from "./MoneyDisplay";
import { Sheet } from "./Sheet";

const meta: Meta<typeof Sheet> = {
  title: "Overlays/Sheet",
  component: Sheet,
  args: { open: true, title: "ชำระบิล ก.ย. 2569", description: "สแกน QR ด้วยแอปธนาคารใดก็ได้", closeLabel: "ปิด" },
};
export default meta;
type Story = StoryObj<typeof Sheet>;

function Demo(args: React.ComponentProps<typeof Sheet>) {
  const [open, setOpen] = useState(args.open);
  return (
    <>
      <Button onClick={() => setOpen(true)}>จ่ายบิล</Button>
      <Sheet
        {...args}
        open={open}
        onOpenChange={setOpen}
        footer={
          <Button size="xl" block onClick={() => setOpen(false)}>
            บันทึก QR
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <div aria-hidden="true" className="bg-bg-subtle rounded-card size-56" />
          <MoneyDisplay amount="4850.50" size="hero" />
        </div>
      </Sheet>
    </>
  );
}

export const Bottom: Story = { render: (args) => <Demo {...args} /> };
export const Right: Story = {
  render: (args) => <Demo {...args} side="right" title="ตัวกรอง" description={undefined} />,
};
