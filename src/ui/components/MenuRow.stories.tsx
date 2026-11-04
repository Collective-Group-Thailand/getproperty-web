import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconLanguage } from "../icons/glyphs/language";
import { IconLogOut } from "../icons/glyphs/log-out";
import { MenuRow } from "./MenuRow";

const meta: Meta<typeof MenuRow> = { title: "Navigation/MenuRow", component: MenuRow };
export default meta;

export const Rows: StoryObj<typeof MenuRow> = {
  render: () => (
    <div className="flex max-w-sm flex-col">
      <MenuRow icon={IconLanguage} trailing="ไทย">
        ภาษา
      </MenuRow>
      <MenuRow icon={IconLogOut} tone="danger">
        ออกจากระบบ
      </MenuRow>
    </div>
  ),
};
