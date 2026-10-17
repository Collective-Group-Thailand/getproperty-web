import type { Meta, StoryObj } from "@storybook/react-vite";

import { ImageViewer } from "./ImageViewer";

const SAMPLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"><rect width="320" height="480" fill="#eef4f1"/><text x="20" y="60" font-size="22">โอนเงินสำเร็จ</text><text x="20" y="110" font-size="18">฿4,850.50</text></svg>',
  );

const meta: Meta<typeof ImageViewer> = {
  title: "Data/ImageViewer",
  component: ImageViewer,
  args: {
    src: SAMPLE,
    alt: "สลิปโอนเงิน ห้อง A-201",
    labels: { zoomIn: "ขยาย", zoomOut: "ย่อ", zoom: (percent: number) => `${percent}%` },
  },
};
export default meta;

type Story = StoryObj<typeof ImageViewer>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
