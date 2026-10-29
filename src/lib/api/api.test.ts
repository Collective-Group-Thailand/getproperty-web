// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createApiClient, unwrap } from "./client";
import { ApiError, applyFieldErrors, problemError, SubscriptionSuspendedError, toFieldName } from "./errors";
import { IDEMPOTENT_OPERATIONS } from "./generated/idempotent";
import { OPERATIONS } from "./generated/operations";

describe("ApiError", () => {
  it("carries the problem fields and knows compliance refusals", () => {
    const error = problemError(422, {
      code: "compliance.tariff_cap",
      detail: "สูงกว่าอัตรา",
      legalRef: "ประกาศ สคบ. ข้อ 4",
      requestId: "r-1",
      errors: [{ path: "lines[1].pricePerUnit", code: "max", message: "too high" }],
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.isCompliance).toBe(true);
    expect(error.legalRef).toBe("ประกาศ สคบ. ข้อ 4");
    expect(error.requestId).toBe("r-1");
  });

  it("is a SubscriptionSuspendedError for tenant.read_only (D-082)", () => {
    expect(problemError(403, { code: "tenant.read_only" })).toBeInstanceOf(SubscriptionSuspendedError);
    expect(problemError(403, { code: "auth.forbidden" })).not.toBeInstanceOf(SubscriptionSuspendedError);
  });

  it("maps field paths onto react-hook-form names", () => {
    expect(toFieldName("lines[1].pricePerUnit")).toBe("lines.1.pricePerUnit");
    const setError = vi.fn();
    const error = problemError(422, {
      code: "validation.failed",
      errors: [
        { path: "email", code: "isEmail", message: "bad" },
        { path: "lines[0].units", code: "min", message: "low" },
        { path: "unknownField", code: "x", message: "?" },
      ],
    });
    const unmatched = applyFieldErrors(error, setError, ["email", "lines"]);
    expect(setError).toHaveBeenCalledWith("email", { type: "isEmail", message: "bad" }, { shouldFocus: true });
    expect(setError).toHaveBeenCalledWith("lines.0.units", { type: "min", message: "low" }, { shouldFocus: false });
    expect(unmatched).toEqual([{ path: "unknownField", code: "x", message: "?" }]);
  });
});

describe("createApiClient", () => {
  const seen: Request[] = [];
  const fetchImpl = vi.fn(async (request: Request) => {
    seen.push(request);
    if (request.url.endsWith("/v1/owner/me")) {
      return new Response(JSON.stringify({ code: "tenant.context_required", detail: "เลือก", status: 400 }), {
        status: 400,
        headers: { "content-type": "application/problem+json", "x-request-id": "rid" },
      });
    }
    return Response.json({ id: "1", createdAt: "x" }, { status: 201 });
  });
  const client = createApiClient({
    baseUrl: "http://api",
    headers: () => ({ authorization: "Bearer t", "x-tenant-id": undefined }),
    fetch: fetchImpl as unknown as typeof fetch,
    idempotentOperations: IDEMPOTENT_OPERATIONS,
  });

  it("adds X-Request-Id and the static headers, skipping undefined ones", async () => {
    // Not an idempotent operation in the contract: no key is added.
    await client.POST("/v1/owner/notifications/{notificationId}/actions/read", {
      params: { path: { notificationId: "3b241101-e2bb-4255-8caf-4136c566a962" } },
    });
    const request = seen.at(-1)!;
    expect(request.headers.get("authorization")).toBe("Bearer t");
    expect(request.headers.get("x-request-id")).toMatch(/[0-9a-f-]{36}/);
    expect(request.headers.has("x-tenant-id")).toBe(false);
    expect(request.headers.has("idempotency-key")).toBe(false);
  });

  it("adds an Idempotency-Key to the operations the contract flags", async () => {
    const flagged = Object.entries(OPERATIONS).find(
      ([key, flags]) => flags.idempotencyKey && key.startsWith("POST /v1/owner/bank-accounts"),
    );
    expect(flagged).toBeDefined();
    await client.POST("/v1/owner/bank-accounts", {
      // The required header is typed; a caller that omits it at runtime still gets one.
      params: { header: {} as { "Idempotency-Key": string } },
      body: {} as never,
    });
    expect(seen.at(-1)!.headers.get("idempotency-key")).toMatch(/[0-9a-f-]{36}/);
  });

  it("unwrap throws a typed ApiError with the problem and the request id", async () => {
    const error = await unwrap(client.GET("/v1/owner/me")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("tenant.context_required");
    expect((error as ApiError).detail).toBe("เลือก");
    expect((error as ApiError).requestId).toBe("rid");
  });
});
