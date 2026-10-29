/**
 * API codes and setting keys are dotted (`assistant.limit_reached`, `late_fee.amount`), but next-intl splits a
 * message key on `.` and walks nested objects — a dotted JSON key can never resolve, and the screen shows the raw
 * key path instead (review M2). Message files therefore never hold dotted keys (`messages.test.ts`), and a code is
 * looked up through this: the optional `prefix` is dropped, every remaining `.` becomes `_`.
 *
 * `messageKey("assistant.limit_reached", "assistant.")` → `limit_reached`;
 * `messageKey("late_fee.amount")` → `late_fee_amount`.
 */
export function messageKey(code: string, prefix = ""): string {
  const rest = prefix && code.startsWith(prefix) ? code.slice(prefix.length) : code;
  return rest.replaceAll(".", "_");
}
