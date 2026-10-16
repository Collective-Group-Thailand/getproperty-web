import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

const meta: Meta<typeof Dialog> = {
  title: "Overlays/Dialog",
  component: Dialog,
  args: { open: true, title: "เพิ่มห้อง", description: "ห้องใหม่จะว่างจนกว่าจะมีสัญญาเช่า", closeLabel: "ปิด" },
};
export default meta;
type Story = StoryObj<typeof Dialog>;

function Demo(args: React.ComponentProps<typeof Dialog>) {
  const [open, setOpen] = useState(args.open);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        เปิด
      </Button>
      <Dialog
        {...args}
        open={open}
        onOpenChange={setOpen}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => setOpen(false)}>บันทึก</Button>
          </>
        }
      >
        <Field label="ชื่อห้อง">
          <Input defaultValue="A-305" />
        </Field>
      </Dialog>
    </>
  );
}

export const Open: Story = { render: (args) => <Demo {...args} /> };
export const Large: Story = { render: (args) => <Demo {...args} size="lg" /> };
