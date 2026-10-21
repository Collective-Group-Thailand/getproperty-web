import { describe, expect, it } from "vitest";

import {
  CREDENTIAL_KEY_TEMPLATES,
  CREDENTIAL_PROVIDERS,
  credentialFormProblems,
  credentialValues,
  keyTemplate,
  kindsFor,
} from "./providers";

describe("provider credentials (D-240)", () => {
  it("offers a key template for every provider the contract names", () => {
    for (const providers of Object.values(CREDENTIAL_PROVIDERS))
      for (const provider of providers) expect(CREDENTIAL_KEY_TEMPLATES[provider]?.length).toBeGreaterThan(0);
    expect(keyTemplate("unknown")).toEqual([]);
  });

  it("limits the platform merchant to payment credentials", () => {
    expect(kindsFor(null)).toEqual(["payment"]);
    expect(kindsFor("0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11")).toEqual(["payment", "lock", "etax"]);
  });

  it("builds the write-only document from the rows without touching values", () => {
    expect(
      credentialValues([
        { name: " apiKey ", value: "k_live 1 " },
        { name: "", value: "" },
        { name: "webhookSecret", value: "s" },
      ]),
    ).toEqual({ apiKey: "k_live 1 ", webhookSecret: "s" });
  });

  it("names what the API would refuse before sending", () => {
    expect(credentialFormProblems([])).toEqual(["noKeys"]);
    expect(
      credentialFormProblems([
        { name: "1key", value: "x" },
        { name: "a", value: "" },
        { name: "a", value: "y" },
      ]),
    ).toEqual(expect.arrayContaining(["keyName", "emptyValue", "duplicateKey"]));
    expect(credentialFormProblems([{ name: "a", value: "x".repeat(4097) }])).toEqual(["valueTooLong"]);
    expect(
      credentialFormProblems(Array.from({ length: 21 }, (_, index) => ({ name: `k${index}`, value: "v" }))),
    ).toEqual(["tooManyKeys"]);
    expect(credentialFormProblems([{ name: "apiKey", value: "v" }])).toEqual([]);
  });
});
