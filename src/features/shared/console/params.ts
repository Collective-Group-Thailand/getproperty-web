/** A page's `searchParams` value as one string (`?a=1&a=2` → the first). */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A 1-based page number from the URL, never below 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(param(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** A search parameter that must be one of `values` (an enum of the contract), else `undefined`. */
export function enumParam<Value extends string>(
  value: string | string[] | undefined,
  values: readonly Value[],
): Value | undefined {
  const one = param(value);
  return one !== undefined && (values as readonly string[]).includes(one) ? (one as Value) : undefined;
}

/** Runs an API read for a section of a page; a failure becomes `{ error }` for the section's error state. */
export async function section<T>(read: Promise<T>): Promise<{ data: T; error: null } | { data: null; error: unknown }> {
  try {
    return { data: await read, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** A path with search parameters; empty values are left out. */
export function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}
