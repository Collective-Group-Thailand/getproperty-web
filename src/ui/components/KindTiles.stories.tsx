import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconCar } from "../icons/glyphs/car";
import { IconHammer } from "../icons/glyphs/hammer";
import { IconMore } from "../icons/glyphs/more";
import { IconResident } from "../icons/glyphs/resident";
import { IconTruck } from "../icons/glyphs/truck";
import { KindTiles } from "./KindTiles";

const meta: Meta<typeof KindTiles> = {
  title: "Gate/KindTiles",
  component: KindTiles,
  args: {
    label: "ประเภทการติดต่อ",
    value: null,
    onValueChange: () => {},
    options: [
      { value: "guest", label: "แขก", icon: IconResident },
      { value: "delivery", label: "ส่งของ/อาหาร", icon: IconTruck },
      { value: "contractor", label: "ผู้รับเหมา", icon: IconHammer },
      { value: "resident_vehicle", label: "รถประจำบ้าน", icon: IconCar },
      { value: "other", label: "อื่น ๆ", icon: IconMore },
    ],
  },
  parameters: { layout: "padded" },
};
export default meta;

export const None: StoryObj<typeof KindTiles> = {};
export const Chosen: StoryObj<typeof KindTiles> = { args: { value: "delivery" } };
