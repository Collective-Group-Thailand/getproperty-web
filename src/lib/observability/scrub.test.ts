import { describe, expect, it } from "vitest";

import { scrubEvent, scrubUrl } from "./scrub";

const TOKEN = "q3K8xF0bW2yR9mT4vN6pL1sA7dE5gH0j";

/** Review L4: the getbuild invitation token is a bearer credential in the path; it never reaches Sentry. */
describe("Sentry scrubbing of /handoff/<token> (review L4)", () => {
  it("masks the token in absolute and relative URLs, with or without a locale", () => {
    expect(scrubUrl(`https://getproperty.co/handoff/${TOKEN}`)).toBe("https://getproperty.co/handoff/[redacted]");
    expect(scrubUrl(`https://getproperty.co/en/handoff/${TOKEN}?utm_source=line`)).toBe(
      "https://getproperty.co/en/handoff/[redacted]?utm_source=line",
    );
    expect(scrubUrl(`/handoff/${TOKEN}`)).toBe("/handoff/[redacted]");
    expect(scrubUrl("/listings/handoffs/claim?token=abc")).toBe("/listings/handoffs/claim?token=%5Bredacted%5D");
  });

  it("masks the request URL, the transaction and navigation breadcrumbs (from / to)", () => {
    const event = scrubEvent({
      request: { url: `https://getproperty.co/handoff/${TOKEN}` },
      transaction: `/handoff/${TOKEN}`,
      breadcrumbs: [
        { data: { from: "/rent", to: `/handoff/${TOKEN}` } },
        { data: { url: `https://getproperty.co/en/handoff/${TOKEN}`, method: "GET" } },
      ],
    });
    expect(JSON.stringify(event)).not.toContain(TOKEN);
    expect(event.breadcrumbs![0]!.data).toEqual({ from: "/rent", to: "/handoff/[redacted]" });
    expect(event.request!.url).toBe("https://getproperty.co/handoff/[redacted]");
  });
});
