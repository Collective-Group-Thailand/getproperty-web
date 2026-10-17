import type { Meta, StoryObj } from "@storybook/react-vite";

import { Pagination } from "./Pagination";

const meta: Meta<typeof Pagination> = {
  title: "Navigation/Pagination",
  component: Pagination,
  args: {
    page: 4,
    perPage: 25,
    total: 312,
    href: (page) => `?page=${page}`,
    labels: {
      nav: "หน้า",
      previous: "หน้าก่อน",
      next: "หน้าถัดไป",
      range: "76–100 จาก 312",
      page: (page) => `หน้า ${page}`,
    },
  },
};
export default meta;

type Story = StoryObj<typeof Pagination>;

export const Middle: Story = {};
export const First: Story = { args: { page: 1, labels: { ...meta.args!.labels!, range: "1–25 จาก 312" } } };
export const Dark: Story = { globals: { theme: "dark" } };
