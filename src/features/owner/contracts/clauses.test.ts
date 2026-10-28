import { describe, expect, it } from "vitest";

import { insertVariable, outline, stripTags, textParts, variablesIn } from "./clauses";

const TEXT =
  '<article class="contract"><h1>สัญญาจอง</h1><p>{{contract.number}}</p>' +
  "<section><h2>คู่สัญญา</h2><p>ผู้ให้เช่า {{lessor.legalName}} &amp; ผู้จอง {{lessee.name}}</p></section>" +
  "<section><p>{{#if reservation.refundTerms}}{{reservation.refundTerms}}{{/if}} {{this.title}}</p></section>" +
  "</article>";

describe("contract text outline (G3)", () => {
  it("splits sections by their h2, keeps the frame first and strips every tag", () => {
    const clauses = outline(TEXT);
    expect(clauses.map((c) => c.title)).toEqual(["", "คู่สัญญา", "§2"]);
    expect(clauses[0]!.text).toBe("สัญญาจอง {{contract.number}}");
    expect(clauses[1]!.text).toBe("ผู้ให้เช่า {{lessor.legalName}} & ผู้จอง {{lessee.name}}");
    expect(clauses[1]!.text).not.toContain("<");
  });

  it("lists the variables used once each — block arguments in, keywords and this.* out", () => {
    expect(variablesIn(TEXT)).toEqual([
      "contract.number",
      "lessor.legalName",
      "lessee.name",
      "reservation.refundTerms",
    ]);
    expect(outline(TEXT)[2]!.variables).toEqual(["reservation.refundTerms"]);
  });

  it("never lets markup through the plain text", () => {
    expect(stripTags('<img src=x onerror="alert(1)">ข้อ&lt;1&gt;')).toBe("ข้อ<1>");
  });

  it("marks variables inside the text", () => {
    expect(textParts("ค่าจอง {{ reservation.fee }} บาท")).toEqual([
      { kind: "text", value: "ค่าจอง " },
      { kind: "variable", value: "reservation.fee" },
      { kind: "text", value: " บาท" },
    ]);
  });

  it("inserts a variable in place of the selection", () => {
    expect(insertVariable("ab--cd", 2, 4, "lease.rent")).toEqual({ text: "ab{{lease.rent}}cd", caret: 16 });
  });
});
