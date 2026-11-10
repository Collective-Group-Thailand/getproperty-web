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
    expect(scrubUrl("https://getproperty.co/en/juristic/join/JW7KQ2M9XA")).toBe(
      "https://getproperty.co/en/juristic/join/[redacted]",
    );
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

/** Review W6: the debt clearance verify code (D-306) is a capability in the path — whoever holds it reads the document. */
describe("Sentry scrubbing of /verify/<code> (review W6)", () => {
  it("masks the code on the public page and the API call, with or without a locale", () => {
    expect(scrubUrl("https://getproperty.co/verify/DC-7KQ2M9XA")).toBe("https://getproperty.co/verify/[redacted]");
    expect(scrubUrl("https://getproperty.co/en/verify/DC-7KQ2M9XA?utm_source=qr")).toBe(
      "https://getproperty.co/en/verify/[redacted]?utm_source=qr",
    );
    expect(scrubUrl("http://api.internal/v1/public/documents/verify/DC-7KQ2M9XA")).toBe(
      "http://api.internal/v1/public/documents/verify/[redacted]",
    );
    expect(scrubUrl("/verify/DC-7KQ2M9XA")).toBe("/verify/[redacted]");
  });

  it("masks the transaction and breadcrumbs of a verify page view", () => {
    const event = scrubEvent({
      transaction: "/th/verify/DC-7KQ2M9XA",
      breadcrumbs: [{ data: { from: "/", to: "/th/verify/DC-7KQ2M9XA" } }],
    });
    expect(JSON.stringify(event)).not.toContain("DC-7KQ2M9XA");
  });
});
