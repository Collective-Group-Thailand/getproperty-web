import type { Schemas } from "@/lib/api/types";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `SiteSurveyState` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type SiteSurveyState = Schemas["SiteSurveyState"];

export const SITE_SURVEY_STATUS = defineStatuses<SiteSurveyState>("siteSurvey", {
  requested: { tone: "warning", icon: IconClock },
  scheduled: { tone: "info", icon: IconCalendar },
  done: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

export const SITE_SURVEY_VALUES = Object.keys(SITE_SURVEY_STATUS) as SiteSurveyState[];
