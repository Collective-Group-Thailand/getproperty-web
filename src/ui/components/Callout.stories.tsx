import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Callout } from "./Callout";

const meta: Meta<typeof Callout> = {
  title: "Feedback/Callout",
  component: Callout,
  args: { title: "มีสลิป 3 ใบรอตรวจ", children: "ตรวจก่อน 12:00 เพื่อออกใบเสร็จวันนี้", tone: "warning" },
};
export default meta;
type Story = StoryObj<typeof Callout>;

export const Attention: Story = {};
export const Compliance: Story = {
  args: {
    tone: "danger",
    title: "ไม่สามารถออกบิลค่าไฟหน่วยละ ฿8.00",
    children: "อัตราสูงสุดที่เรียกเก็บได้คืออัตราของการไฟฟ้า ฿4.18/หน่วย (รวม Ft) แก้อัตราในตั้งค่าแล้วออกบิลใหม่",
    legalRef: "ตามประกาศคณะกรรมการว่าด้วยสัญญา เรื่องธุรกิจการให้เช่าอาคารเพื่ออยู่อาศัย พ.ศ. 2568 ข้อ 4(1)",
    action: (
      <Button size="sm" variant="secondary">
        ไปที่ตั้งค่าอัตรา
      </Button>
    ),
  },
};
export const Success: Story = {
  args: { tone: "success", title: "ออกบิลครบ 42 ห้อง", children: "ส่งทาง LINE แล้ว 40 ห้อง อีก 2 ห้องรอผูก LINE" },
};
export const Info: Story = {
  args: { tone: "info", title: undefined, children: "เลขมิเตอร์นี้เป็นค่าประมาณการ จะปรับในรอบถัดไปเมื่อมีเลขจริง" },
};
export const Neutral: Story = {
  args: { tone: "neutral", title: undefined, children: "โหมดอ่านอย่างเดียว — แพ็กเกจถูกระงับ ข้อมูลยังอยู่ครบ" },
};
