import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatBytes, formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { Progress } from "@/ui/components/Progress";
import { IconShield } from "@/ui/icons/glyphs/shield";

type Storage = Schemas["OwnerStorageDto"];

const LEVEL_TONE = { ok: "success", warning: "warning", full: "danger", over: "danger" } as const;
const BAR_TONE = { ok: "primary", warning: "warning", full: "danger", over: "danger" } as const;
const RECORD_ORDER = ["invoice", "receipt", "payment", "meter_reading", "lease", "service_request"] as const;
const CATEGORY_ORDER = ["listing_media", "attachment", "system_legal", "system_other"] as const;

/**
 * Storage (D-276): one figure (what is used), the bar against the allowance, and what makes up the number — files at
 * their size and records at their counted size. The copy never threatens: data is never deleted or locked, documents
 * the law requires are always produced. Every number is the API's; nothing is computed here but the remainder.
 * G1 (D-285, D-286): the quota as free allowance + packages, where the space goes by category, the legal-hold share
 * (counted, never deletable, always issued) and what waits for its purge.
 */
export async function StorageCard({
  storage,
  error,
  locale,
  manageHref,
}: {
  storage: Storage | null;
  error: unknown;
  locale: Locale;
  /** The storage page (files, packages); omitted on that page itself. */
  manageHref?: string;
}) {
  const t = await getTranslations("owner.subscription.storage");
  if (!storage)
    return (
      <Card as="section" aria-labelledby="sub-storage" data-testid="storage">
        <CardHeader title={<span id="sub-storage">{t("title")}</span>} />
        <SectionError error={error} />
      </Card>
    );

  const used = BigInt(storage.usedBytes);
  const files = BigInt(storage.fileBytes);
  const records = used > files ? used - files : 0n;
  const allowance = storage.allowanceBytes ? BigInt(storage.allowanceBytes) : null;
  const level = storage.level;
  const recordCount = Object.values(storage.records).reduce((sum, n) => sum + n, 0);
  const packageBytes = BigInt(storage.packageBytes);
  const legalHold = BigInt(storage.legalHoldBytes);
  const pendingPurge = BigInt(storage.pendingPurgeBytes);
  const categories = CATEGORY_ORDER.map(
    (category) => storage.categories.find((row) => row.category === category) ?? { category, bytes: "0", objects: 0 },
  );
  const recordList = RECORD_ORDER.filter((type) => (storage.records[type] ?? 0) > 0).map((type) =>
    t("recordItem", { label: t(`records.${type}`), count: formatNumber(storage.records[type] ?? 0, locale) }),
  );

  return (
    <Card as="section" aria-labelledby="sub-storage" data-testid="storage">
      <CardHeader
        title={<span id="sub-storage">{t("title")}</span>}
        description={t("description")}
        action={
          <span className="flex items-center gap-3">
            {manageHref ? (
              <a
                href={manageHref}
                className="text-primary text-sm font-medium hover:underline"
                data-testid="storage-manage"
              >
                {t("manage")}
              </a>
            ) : null}
            {level ? (
              <Badge tone={LEVEL_TONE[level]} size="sm">
                <span data-testid="storage-level">{t(`level.${level}`)}</span>
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                <span data-testid="storage-level">{t("level.unmetered")}</span>
              </Badge>
            )}
          </span>
        }
      />

      <div className="flex flex-col gap-5">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums" data-testid="storage-used">
            {formatBytes(storage.usedBytes, locale)}
          </span>
          <span className="text-muted">
            {allowance !== null
              ? t("ofAllowance", { allowance: formatBytes(storage.allowanceBytes!, locale) })
              : t("noAllowance")}
          </span>
          {storage.freeBytes ? (
            <span className="text-muted w-full text-sm" data-testid="storage-quota">
              {packageBytes > 0n
                ? t("quotaWithPackages", {
                    free: formatBytes(storage.freeBytes, locale),
                    packages: formatBytes(storage.packageBytes, locale),
                  })
                : t("quotaFree", { free: formatBytes(storage.freeBytes, locale) })}
            </span>
          ) : null}
        </p>

        {allowance !== null && level ? (
          <Progress
            label={t("title")}
            value={Number(used > allowance ? allowance : used)}
            max={Number(allowance)}
            tone={BAR_TONE[level]}
            valueText={
              used > allowance
                ? t("overBy", {
                    percent: storage.usedPercent ?? 0,
                    bytes: formatBytes(String(used - allowance), locale),
                  })
                : t("left", { percent: storage.usedPercent ?? 0, bytes: formatBytes(String(allowance - used), locale) })
            }
          />
        ) : null}

        <dl className="border-border grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-muted text-sm">{t("files")}</dt>
            <dd className="font-semibold tabular-nums" data-testid="storage-files">
              {formatBytes(storage.fileBytes, locale)}
            </dd>
            <dd className="text-muted text-sm">{t("filesHint")}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted text-sm">{t("recordsLabel")}</dt>
            <dd className="font-semibold tabular-nums">
              {formatBytes(String(records), locale)}
              <span className="text-muted ms-2 text-sm font-normal">
                {t("recordCount", { count: formatNumber(recordCount, locale) })}
              </span>
            </dd>
            {recordList.length ? (
              <dd className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {/* one item never breaks inside a Thai word ("ค่า|มิเตอร์") */}
                {recordList.map((item) => (
                  <span key={item} className="whitespace-nowrap">
                    {item}
                  </span>
                ))}
              </dd>
            ) : null}
          </div>
        </dl>

        {files > 0n ? (
          <section aria-labelledby="storage-categories" className="border-border flex flex-col gap-3 border-t pt-4">
            <h3 id="storage-categories" className="text-sm font-semibold">
              {t("categoriesTitle")}
            </h3>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2" data-testid="storage-categories">
              {categories.map((row) => (
                <li
                  key={row.category}
                  className="flex flex-col gap-1"
                  data-testid="storage-category"
                  data-category={row.category}
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{t(`category.${row.category}`)}</span>
                    <span className="font-semibold tabular-nums">{formatBytes(row.bytes, locale)}</span>
                  </span>
                  <Progress
                    label={t(`category.${row.category}`)}
                    value={Number(BigInt(row.bytes))}
                    max={Number(files)}
                    valueText={formatBytes(row.bytes, locale)}
                    showCaption={false}
                  />
                  <span className="text-muted text-xs">
                    {t("categoryObjects", { count: formatNumber(row.objects, locale) })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {legalHold > 0n ? (
          <Callout
            tone="info"
            icon={IconShield}
            title={t("legalHold.title", { bytes: formatBytes(storage.legalHoldBytes, locale) })}
          >
            <span data-testid="storage-legal-hold">{t("legalHold.body")}</span>
          </Callout>
        ) : null}

        {pendingPurge > 0n ? (
          <p className="text-muted text-sm" data-testid="storage-pending-purge">
            {t("pendingPurge", { bytes: formatBytes(storage.pendingPurgeBytes, locale) })}
          </p>
        ) : null}

        <p className="text-muted text-sm" data-testid="storage-note">
          {allowance === null
            ? t("note.unmetered")
            : level === "over" && storage.pricePerGbMonth
              ? t("note.billed", { price: formatTHB(storage.pricePerGbMonth, locale) })
              : level === "full" || level === "over"
                ? t("note.full")
                : t("note.safe")}
        </p>
      </div>
    </Card>
  );
}
