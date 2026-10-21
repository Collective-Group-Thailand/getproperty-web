import { describe, expect, it } from "vitest";

import { notificationHref } from "./links";

describe("notificationHref", () => {
  it("opens the owner's queue of the event, with the locale prefix outside Thai", () => {
    expect(notificationHref("owner", "party.link_requested", "th")).toBe("/parties/link-requests");
    expect(notificationHref("owner", "payment.held", "en")).toBe("/en/payments/held");
    expect(notificationHref("owner", "foreign_stay.due", "th")).toBe("/tm30");
    expect(notificationHref("owner", "etax.rejected", "en")).toBe("/en/reports/etax?status=rejected");
  });

  it("gives no link for unknown events, missing event types or other zones", () => {
    expect(notificationHref("owner", "lease.signed.unknown", "th")).toBeNull();
    expect(notificationHref("owner", null, "th")).toBeNull();
    expect(notificationHref("admin", "payment.held", "th")).toBeNull();
    expect(notificationHref("staff", "party.link_requested", "th")).toBeNull();
  });
});
