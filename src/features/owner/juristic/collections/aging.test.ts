import { describe, expect, it } from "vitest";

import { agingTiles, type AgingWords } from "./aging";

const words: AgingWords = {
  range: (from, to) => `${from}–${to} วัน`,
  over: (from) => `${from} วันขึ้นไป`,
  accounts: (count) => `${count} ราย`,
  money: (amount) => `฿${amount}`,
  oldest: "เกิน 1 ปี",
};
const bucket = (key: string, fromDays: number, toDays: number | null, accounts: number, amount = "0.00") => ({
  key,
  fromDays,
  toDays,
  accounts,
  invoices: accounts,
  amount,
});

describe("aging strip tiles (J-DESIGN §4)", () => {
  it("labels buckets from day 1 and keeps the API's counts and amounts", () => {
    const tiles = agingTiles([bucket("0-30", 0, 30, 18, "248400.00"), bucket("31-90", 31, 90, 11)], words);
    expect(tiles.map((tile) => [tile.label, tile.count, tile.amount])).toEqual([
      ["1–30 วัน", "18 ราย", "฿248400.00"],
      ["31–90 วัน", "11 ราย", "฿0.00"],
    ]);
  });

  it("badges only the open-ended oldest bucket, and only when someone is in it", () => {
    const four = [bucket("a", 0, 30, 1), bucket("b", 31, 90, 1), bucket("c", 91, 365, 1), bucket("d", 366, null, 4)];
    expect(agingTiles(four, words).map((tile) => tile.badge)).toEqual([undefined, undefined, undefined, "เกิน 1 ปี"]);
    expect(agingTiles([...four.slice(0, 3), bucket("d", 366, null, 0)], words)[3]?.badge).toBeUndefined();
    expect(agingTiles(four, words)[3]?.label).toBe("366 วันขึ้นไป");
  });

  it("links a tile where the page asks", () => {
    const tiles = agingTiles([bucket("a", 0, 30, 1)], { ...words, href: (b) => `/r?bucket=${b.key}` });
    expect(tiles[0]?.href).toBe("/r?bucket=a");
  });
});
