import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AlertDialog } from "./AlertDialog";
import { Button } from "./Button";

const meta: Meta<typeof AlertDialog> = {
  title: "Overlays/AlertDialog",
  component: AlertDialog,
  args: {
    open: true,
    title: "ยกเลิกบิล A-301 เดือน ก.ย. 2569?",
    description:
      "บิลจำนวน ฿4,850.50 จะถูกยกเลิก ผู้เช่าจะได้รับแจ้งทาง LINE และต้องออกบิลใหม่ การกระทำนี้ย้อนกลับไม่ได้",
    confirmLabel: "ยกเลิกบิล",
    cancelLabel: "กลับ",
    tone: "destructive",
  },
};
export default meta;
type Story = StoryObj<typeof AlertDialog>;

function Demo(args: React.ComponentProps<typeof AlertDialog>) {
  const [open, setOpen] = useState(args.open);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        ยกเลิกบิล
      </Button>
      <AlertDialog {...args} open={open} onOpenChange={setOpen} onConfirm={() => setOpen(false)} />
    </>
  );
}

export const Destructive: Story = { render: (args) => <Demo {...args} /> };
export const TypedConfirmation: Story = {
  render: (args) => <Demo {...args} confirmationPhrase="A-301" confirmationLabel="พิมพ์เลขห้อง A-301 เพื่อยืนยัน" />,
};
export const Primary: Story = {
  render: (args) => (
    <Demo
      {...args}
      tone="primary"
      title="ออกบิล 42 ห้อง รอบ ก.ย. 2569?"
      description="รวม ฿186,420.00 ผู้เช่าจะได้รับบิลทาง LINE ทันที"
      confirmLabel="ออกบิล"
    />
  ),
};
