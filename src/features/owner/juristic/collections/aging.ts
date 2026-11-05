import type { Schemas } from "@/lib/api/types";
import type { AgingTile } from "@/ui/components/AgingStrip";

export interface AgingWords {
  /** "1–30 วัน" */
  range: (from: number, to: number) => string;
  /** "366 วันขึ้นไป" */
  over: (from: number) => string;
  /** "18 ราย" */
  accounts: (count: number) => string;
  money: (amount: string) => string;
  /** The oldest bucket's badge ("เกิน 1 ปี"). */
  oldest: string;
  /** Where a tile leads (the receivables list sorted by age), if anywhere. */
  href?: (bucket: Schemas["AgingBucketDto"]) => string | undefined;
}

/**
 * The aging strip's tiles from the API's buckets (J-DESIGN §4): the bucket's range ("1–30 วัน" — a bucket starting at
 * day 0 reads from day 1, nothing is overdue on its due date), its accounts and amount as the API counted them, and a
 * badge on the open-ended oldest bucket only when it holds anyone — never a fill colour.
 */
export function agingTiles(buckets: readonly Schemas["AgingBucketDto"][], words: AgingWords): AgingTile[] {
  return buckets.map((bucket, index) => ({
    key: bucket.key,
    label:
      bucket.toDays === null ? words.over(bucket.fromDays) : words.range(Math.max(1, bucket.fromDays), bucket.toDays),
    count: words.accounts(bucket.accounts),
    amount: words.money(bucket.amount),
    badge: index === buckets.length - 1 && bucket.toDays === null && bucket.accounts > 0 ? words.oldest : undefined,
    href: words.href?.(bucket),
  }));
}
