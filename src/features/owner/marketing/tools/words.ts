/* Amounts in words for the rent-receipt maker (D-271): Thai "บาทถ้วน" style and English. Input is a decimal string
   with two decimals as produced by `estimate.ts`. */

const TH_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Reads 0 < n < 1,000,000 in Thai. */
function thaiGroup(n: number): string {
  const digits = String(n).split("").map(Number).reverse();
  let out = "";
  for (let place = digits.length - 1; place >= 0; place--) {
    const d = digits[place]!;
    if (d === 0) continue;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && n > 9) out += "เอ็ด";
    else out += TH_DIGITS[d] + TH_PLACES[place];
  }
  return out;
}

function thaiNumber(n: bigint): string {
  if (n === 0n) return TH_DIGITS[0]!;
  const millions = n / 1000000n;
  const rest = Number(n % 1000000n);
  return (millions > 0n ? `${thaiNumber(millions)}ล้าน` : "") + (rest > 0 ? thaiGroup(rest) : "");
}

export function bahtTextTh(amount: string): string {
  const [whole = "0", fraction = "00"] = amount.split(".");
  const baht = BigInt(whole);
  const satang = Number(fraction.padEnd(2, "0").slice(0, 2));
  if (baht === 0n && satang === 0) return "ศูนย์บาทถ้วน";
  const bahtPart = baht > 0n ? `${thaiNumber(baht)}บาท` : "";
  return satang === 0 ? `${bahtPart}ถ้วน` : `${bahtPart}${thaiGroup(satang)}สตางค์`;
}

const EN_ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const EN_SCALES: [bigint, string][] = [
  [1000000000n, "billion"],
  [1000000n, "million"],
  [1000n, "thousand"],
];

function englishUnder1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${EN_ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(EN_TENS[Math.floor(n / 10)]! + (n % 10 ? `-${EN_ONES[n % 10]}` : ""));
  else if (n > 0) parts.push(EN_ONES[n]!);
  return parts.join(" ");
}

function englishNumber(n: bigint): string {
  if (n === 0n) return "zero";
  const parts: string[] = [];
  for (const [size, name] of EN_SCALES) {
    if (n >= size) {
      parts.push(`${englishNumber(n / size)} ${name}`);
      n %= size;
    }
  }
  if (n > 0n) parts.push(englishUnder1000(Number(n)));
  return parts.join(" ");
}

export function bahtTextEn(amount: string): string {
  const [whole = "0", fraction = "00"] = amount.split(".");
  const satang = Number(fraction.padEnd(2, "0").slice(0, 2));
  const text = `${englishNumber(BigInt(whole))} baht${satang ? ` and ${englishUnder1000(satang)} satang` : " only"}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
