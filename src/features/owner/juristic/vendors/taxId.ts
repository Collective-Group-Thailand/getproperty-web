/**
 * Thai tax identification numbers (13 digits; the last is a mod-11 check digit, Revenue Department). The API verifies
 * again; checking here gives an inline error before sending. Separators people type ("0-1055-58123-45-6") are allowed.
 */
export function cleanTaxId(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function taxIdProblem(value: string): "length" | "checksum" | null {
  const digits = cleanTaxId(value);
  if (!digits) return null;
  if (!/^\d{13}$/.test(digits)) return "length";
  const numbers = digits.split("").map(Number);
  const sum = numbers.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === numbers[12] ? null : "checksum";
}
