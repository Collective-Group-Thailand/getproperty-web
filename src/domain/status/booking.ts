import type { Schemas } from "@/lib/api/types";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/**
 * `BookingStatus` — contract enum, ops.facility_booking (B5.3, D-212). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type BookingStatus = Schemas["BookingStatus"];

export const BOOKING_STATUS = defineStatuses<BookingStatus>("booking", {
  requested: { tone: "warning", icon: IconClock },
  confirmed: { tone: "success", icon: IconCalendarCheck },
  cancelled: { tone: "neutral", icon: IconXCircle },
  no_show: { tone: "neutral", icon: IconFlag },
});

export const BOOKING_VALUES = Object.keys(BOOKING_STATUS) as BookingStatus[];
