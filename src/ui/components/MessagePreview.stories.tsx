import type { Meta, StoryObj } from "@storybook/react-vite";

import { MessagePreview } from "./MessagePreview";

const meta: Meta<typeof MessagePreview> = { title: "Data/MessagePreview", component: MessagePreview };
export default meta;

export const Announcement: StoryObj<typeof MessagePreview> = {
  args: {
    label: "ตัวอย่างใน LINE",
    sender: "หอพักตัวอย่าง",
    title: "งดจ่ายน้ำชั่วคราว วันเสาร์นี้",
    body: "การประปาจะซ่อมท่อหลักหน้าอาคาร วันเสาร์ 9:00–12:00 น. กรุณาสำรองน้ำไว้ใช้",
    note: "ปักหมุดถึง 30 พ.ย. 2569",
  },
};

export const Empty: StoryObj<typeof MessagePreview> = {
  args: {
    label: "ตัวอย่างใน LINE",
    sender: "หอพักตัวอย่าง",
    title: "",
    body: "",
    placeholder: "พิมพ์หัวข้อและข้อความเพื่อดูตัวอย่าง",
  },
};
