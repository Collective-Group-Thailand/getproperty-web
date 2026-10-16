import type { Meta, StoryObj } from "@storybook/react-vite";

import { DropdownMenu } from "./DropdownMenu";
import { IconButton } from "./IconButton";

const meta: Meta<typeof DropdownMenu> = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenu,
  args: {
    label: "การกระทำ",
    trigger: <IconButton name="more" label="การกระทำ" />,
    items: [
      { id: "view", label: "ดูบิล", icon: "bill" },
      { id: "remind", label: "แจ้งเตือนผู้เช่า", icon: "chat" },
      { id: "void", label: "ยกเลิกบิล", icon: "delete", destructive: true, separatorBefore: true },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Actions: Story = {};
export const Choices: Story = {
  args: {
    label: "ธีม",
    trigger: <IconButton name="theme-light" label="ธีม" />,
    items: [
      { id: "system", label: "ตามอุปกรณ์", icon: "theme-system" },
      { id: "light", label: "สว่าง", icon: "theme-light", selected: true },
      { id: "dark", label: "มืด", icon: "theme-dark" },
    ],
  },
};
