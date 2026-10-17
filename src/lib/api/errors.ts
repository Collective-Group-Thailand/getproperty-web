import type { Problem, ProblemFieldError } from "./types";

/**
 * Problem details (RFC 9457, contract §3) as a typed error. `code` is the stable, machine-readable
 * key the UI branches on; `detail` is already localised by `Accept-Language`; `legalRef` comes with
 * every `compliance.*` refusal and is always shown (CLAUDE.md: never worked around).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly requestId?: string;
  readonly legalRef?: string;
  readonly ruleId?: string;
  readonly errors: ProblemFieldError[];
  readonly problem: Partial<Problem>;

  constructor(status: number, problem: Partial<Problem>) {
    super(problem.detail || problem.title || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.code = problem.code ?? `http.${status}`;
    this.title = problem.title ?? "";
    this.detail = problem.detail ?? "";
    this.requestId = problem.requestId;
    this.legalRef = problem.legalRef;
    this.ruleId = problem.ruleId;
    this.errors = problem.errors ?? [];
  }

  get isCompliance(): boolean {
    return this.code.startsWith("compliance.");
  }
}

/**
 * The tenant is suspended (D-082): the API refuses every mutation with `tenant.read_only`. The UI
 * turns this into the read-only banner and disables mutations; it never retries.
 */
export class SubscriptionSuspendedError extends ApiError {
  constructor(status: number, problem: Partial<Problem>) {
    super(status, problem);
    this.name = "SubscriptionSuspendedError";
  }
}

/** The request never got an answer (offline, DNS, the BFF unreachable). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("network error", { cause });
    this.name = "NetworkError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const READ_ONLY_CODES = new Set(["tenant.read_only"]);

/** Builds the right error class from a status and a parsed problem body. */
export function problemError(status: number, problem: Partial<Problem>): ApiError {
  return READ_ONLY_CODES.has(problem.code ?? "")
    ? new SubscriptionSuspendedError(status, problem)
    : new ApiError(status, problem);
}

/** Reads a failed `Response` into an `ApiError` (problem+json, or a synthetic problem otherwise). */
export async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    try {
      const body = (await response.clone().json()) as Partial<Problem>;
      return problemError(response.status, { requestId, ...body });
    } catch {
      // fall through to the synthetic problem
    }
  }
  return problemError(response.status, { status: response.status, code: `http.${response.status}`, requestId });
}

/**
 * Field paths from the API (`lines[1].pricePerUnit`) → react-hook-form names (`lines.1.pricePerUnit`).
 */
export function toFieldName(path: string): string {
  return path.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "");
}

/**
 * Puts the API's field errors on a react-hook-form form; returns the errors that matched no field
 * (shown in a form-level callout). `fields` limits which names are considered present.
 */
export function applyFieldErrors(
  error: ApiError,
  setError: (name: string, error: { type: string; message: string }, options?: { shouldFocus?: boolean }) => void,
  fields?: readonly string[],
): ProblemFieldError[] {
  const unmatched: ProblemFieldError[] = [];
  let focused = false;
  for (const fieldError of error.errors) {
    const name = toFieldName(fieldError.path);
    if (fields && !fields.some((field) => name === field || name.startsWith(`${field}.`))) {
      unmatched.push(fieldError);
      continue;
    }
    setError(name, { type: fieldError.code, message: fieldError.message }, { shouldFocus: !focused });
    focused = true;
  }
  return unmatched;
}
