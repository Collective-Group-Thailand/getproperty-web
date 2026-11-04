import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { IconElectric } from "../icons/glyphs/electric";
import { RowList } from "./RowList";

const meta: Meta<typeof RowList> = {
  title: "Data/RowList",
  component: RowList,
  args: {
    label: "เงินประกัน",
    items: [
      {
        key: "1",
        href: "#1",
        lead: "B-102",
        title: "กมล ลาจาก",
        meta: "CT-2568-00011",
        status: <Badge tone="warning">กำลังหักลบ</Badge>,
        figure: "฿4,500.00",
      },
      {
        key: "2",
        href: "#2",
        lead: "A-201",
        title: "สมศักดิ์ ใจดี",
        meta: "CT-2568-00031",
        status: <Badge tone="info">ถือไว้</Badge>,
        figure: "฿4,500.00",
      },
    ],
  },
};
export default meta;
export const Default: StoryObj<typeof RowList> = {};

/** A queue list (admin overview): icon, title, context, owner tag and the count. */
export const WithIcons: StoryObj<typeof RowList> = {
  args: {
    label: "งานที่รอ",
    items: [
      {
        key: "tariffs",
        href: "#tariffs",
        icon: IconElectric,
        title: "อัตราค่าไฟ/น้ำรอตรวจ",
        meta: "1 เวอร์ชันรอคนที่สองตรวจ",
        status: <Badge size="sm">ผู้ดูแลแพลตฟอร์ม</Badge>,
        figure: "1",
      },
    ],
  },
};

/** The narrow queue of a split view (`stacked`): the title keeps two lines, the price beside it, the reason below. */
export const Stacked: StoryObj<typeof RowList> = {
  args: {
    label: "คิวตรวจประกาศ",
    stacked: true,
    className: "max-w-sm",
    items: [
      {
        key: "1",
        href: "#1",
        current: true,
        title: "เดอะ ลอฟท์ ทองหล่อ 35 ตร.ม. พร้อมอยู่",
        meta: "วัฒนา, กรุงเทพมหานคร · มาลี มีสุข",
        status: (
          <Badge tone="info" size="sm">
            ค่าเช่าผิดปกติ
          </Badge>
        ),
        figure: "฿9,000",
      },
      {
        key: "2",
        href: "#2",
        title: "คอนโดใกล้ BTS อ่อนนุช 28 ตร.ม.",
        meta: "สวนหลวง, กรุงเทพมหานคร · สมชาย ใจดี",
        status: (
          <Badge tone="warning" size="sm">
            มีผู้รายงาน 2
          </Badge>
        ),
        figure: "฿12,500",
      },
    ],
  },
};
