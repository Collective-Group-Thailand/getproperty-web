import type { Meta, StoryObj } from "@storybook/react-vite";

import { DropdownMenu } from "./DropdownMenu";
import { IconButton } from "./IconButton";
import { IconBill } from "../icons/glyphs/bill";
import { IconChat } from "../icons/glyphs/chat";
import { IconDelete } from "../icons/glyphs/delete";
import { IconMore } from "../icons/glyphs/more";
import { IconThemeDark } from "../icons/glyphs/theme-dark";
import { IconThemeLight } from "../icons/glyphs/theme-light";
import { IconThemeSystem } from "../icons/glyphs/theme-system";

const meta: Meta<typeof DropdownMenu> = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenu,
  args: {
    label: "การกระทำ",
    trigger: <IconButton icon={IconMore} label="การกระทำ" />,
    items: [
      { id: "view", label: "ดูบิล", icon: IconBill },
      { id: "remind", label: "แจ้งเตือนผู้เช่า", icon: IconChat },
      { id: "void", label: "ยกเลิกบิล", icon: IconDelete, destructive: true, separatorBefore: true },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Actions: Story = {};
export const Choices: Story = {
  args: {
    label: "ธีม",
    trigger: <IconButton icon={IconThemeLight} label="ธีม" />,
    items: [
      { id: "system", label: "ตามอุปกรณ์", icon: IconThemeSystem },
      { id: "light", label: "สว่าง", icon: IconThemeLight, selected: true },
      { id: "dark", label: "มืด", icon: IconThemeDark },
    ],
  },
};
