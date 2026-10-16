import { type ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "./no-money-arithmetic.mjs";

// The rule is plain .mjs; ESLint's RuleDefinition type wants literal unions it cannot infer from JS.
const plugin = { rules: { "no-money-arithmetic": rule } } as unknown as ESLint.Plugin;

function lint(code: string) {
  const linter = new Linter({ configType: "flat", cwd: "/repo" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { ecmaVersion: "latest", sourceType: "module" },
        plugins: { getproperty: plugin },
        rules: { "getproperty/no-money-arithmetic": "error" },
      },
    ],
    { filename: "/repo/src/features/owner/bills/total.ts" },
  );
}

describe("getproperty/no-money-arithmetic", () => {
  it("fails on arithmetic with a money field", () => {
    expect(lint(`const t = bill.amount + bill.lateFee;`)).toHaveLength(1);
    expect(lint(`total += line.amount;`)).toHaveLength(1);
    expect(lint(`const u = reading.currentReading - reading.previousReading;`)).toHaveLength(1);
  });
  it("fails on turning a money field into a number", () => {
    expect(lint(`const n = Number(bill.balance);`)).toHaveLength(1);
    expect(lint(`const n = parseFloat(line.units);`)).toHaveLength(1);
    expect(lint(`const n = +bill.amount;`)).toHaveLength(1);
  });
  it("allows formatting, comparison and concatenation", () => {
    expect(lint(`const s = formatTHB(bill.amount);`)).toHaveLength(0);
    expect(lint(`const same = a.amount === b.amount;`)).toHaveLength(0);
    expect(lint(`const label = "฿" + bill.amount;`)).toHaveLength(0);
    expect(lint(`const n = rooms.length + 1;`)).toHaveLength(0);
  });
});
