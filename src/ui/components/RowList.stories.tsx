import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
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
