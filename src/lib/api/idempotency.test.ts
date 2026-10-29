import { describe, expect, it } from "vitest";

import { IDEMPOTENT_OPERATIONS } from "./generated/idempotent";
import { requiresIdempotencyKey } from "./idempotency";

describe("requiresIdempotencyKey", () => {
  it("matches a concrete path against the contract's templates", () => {
    const template = [...IDEMPOTENT_OPERATIONS].find((op) => op.includes("{"))!;
    const [method, path] = template.split(" ") as [string, string];
    const concrete = path.replace(/\{[^}]+\}/g, "3b241101-e2bb-4255-8caf-4136c566a962");
    expect(requiresIdempotencyKey(method, concrete)).toBe(true);
    expect(requiresIdempotencyKey(method.toLowerCase(), concrete)).toBe(true);
  });

  it("refuses another method, an extra segment and an unflagged path", () => {
    expect(requiresIdempotencyKey("POST", "/v1/owner/bank-accounts")).toBe(true);
    expect(requiresIdempotencyKey("GET", "/v1/owner/bank-accounts")).toBe(false);
    expect(requiresIdempotencyKey("POST", "/v1/owner/bank-accounts/x")).toBe(false);
    expect(requiresIdempotencyKey("POST", "/v1/owner/me")).toBe(false);
  });
});
