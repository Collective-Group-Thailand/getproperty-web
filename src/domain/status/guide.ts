import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import { defineStatuses } from "./define";

/** `GuideState` — contract enum (guides of the public site, D-271). */
export type GuideState = Schemas["GuideState"];

export const GUIDE_STATUS = defineStatuses<GuideState>("guide", {
  draft: { tone: "neutral", icon: IconEdit },
  published: { tone: "success", icon: IconCheckCircle },
});
