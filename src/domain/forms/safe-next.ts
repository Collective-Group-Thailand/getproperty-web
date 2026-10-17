/** `?next=` targets are same-site paths only — never `//host` or a scheme (open-redirect guard). */
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (/[\r\n]/.test(value)) return undefined;
  return value;
}
