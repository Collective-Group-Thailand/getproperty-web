import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHistory } from "@/ui/icons/glyphs/history";

import { defineStatuses } from "./define";

/** `TemplateVersionState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type TemplateVersionState = Schemas["TemplateVersionState"];

export const TEMPLATE_VERSION_STATUS = defineStatuses<TemplateVersionState>("templateVersion", {
  draft: { tone: "neutral", icon: IconEdit },
  published: { tone: "success", icon: IconCheckCircle },
  retired: { tone: "neutral", icon: IconHistory },
});

export const TEMPLATE_VERSION_VALUES = Object.keys(TEMPLATE_VERSION_STATUS) as TemplateVersionState[];
