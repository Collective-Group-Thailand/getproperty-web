import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "@/ui/icons/registry";

import { defineStatuses, INVOICE_STATUS, READING_SOURCE, STATUS_MAPS, SUBSCRIPTION_STATUS } from "./index";

const root = join(__dirname, "../../..");
const contract = JSON.parse(readFileSync(join(root, "contract/openapi.json"), "utf8")) as {
  components: { schemas: Record<string, { enum?: string[] }> };
};
const messages = (locale: string) =>
  JSON.parse(readFileSync(join(root, `src/i18n/messages/${locale}/common/status.json`), "utf8")) as Record<
    string,
    Record<string, string>
  >;

/** The contract component behind each map, where the pinned contract already publishes it. */
const CONTRACT_ENUM: Partial<Record<keyof typeof STATUS_MAPS, string>> = {
  invoice: "InvoiceStatus",
  lease: "LeaseStatus",
  payment: "PaymentStatus",
  deposit: "DepositStatus",
  reading: "ReadingReviewState",
  readingSource: "ReadingSource",
  meterHealth: "MeterHealth",
  device: "DeviceStatus",
  serviceRequest: "ServiceRequestStatus",
  workOrder: "WorkOrderStatus",
  unit: "UnitStatus",
  subscription: "SubscriptionState",
};

describe("status maps", () => {
  it("derive the label key from the domain and value", () => {
    const map = defineStatuses<"a" | "b">("thing", {
      a: { tone: "success", icon: "check" },
      b: { tone: "danger", icon: "alert" },
    });
    expect(map.a.labelKey).toBe("status.thing.a");
  });

  it.each(Object.entries(STATUS_MAPS))("%s names only registry icons and has th + en labels", (domain, map) => {
    for (const [value, meta] of Object.entries(map)) {
      expect(ICON_NAMES).toContain(meta.icon);
      expect(meta.labelKey).toBe(`status.${domain}.${value}`);
      for (const locale of ["th", "en"])
        expect(messages(locale)[domain]?.[value], `${locale} ${meta.labelKey}`).toBeTruthy();
    }
  });

  it.each(Object.entries(CONTRACT_ENUM))("%s covers exactly the published contract enum %s", (domain, component) => {
    const published = contract.components.schemas[component!]?.enum;
    // Not published yet: the planned values (schema-design v2) are used until it is.
    if (!published) return;
    expect(Object.keys(STATUS_MAPS[domain as keyof typeof STATUS_MAPS]).sort()).toEqual([...published].sort());
  });

  it("never paints money that is merely due red (D-100) and keeps estimates amber (D-012)", () => {
    expect(INVOICE_STATUS.overdue.tone).toBe("warning");
    expect(INVOICE_STATUS.partially_paid.tone).not.toBe("danger");
    expect(READING_SOURCE.estimated.tone).toBe("warning");
    expect(SUBSCRIPTION_STATUS.past_due.tone).toBe("warning");
  });
});
