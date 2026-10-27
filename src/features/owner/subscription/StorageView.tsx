import { getTranslations } from "next-intl/server";

import { STORAGE_PACKAGE_STATUS } from "@/domain/status/storagePackage";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatBytes, formatDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconPackageCheck } from "@/ui/icons/glyphs/package-check";

import { ownerPath } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { StorageBanner } from "./StorageBanner";
import { StorageCard } from "./StorageCard";
import { StorageFilesTable } from "./StorageFilesTable";
import { BuyStoragePackage, StorageAutoRenew } from "./StoragePackageActions";

type SearchParams = Record<string, string | string[] | undefined>;
const PER_PAGE = 25;

/**
 * Storage (pack G1; D-276, D-285, D-286, D-292): the meter of the subscription page in full, the storage packages
 * (bought ones with their invoice and auto-renew, offers the platform admin defined — "not on sale yet" while they
 * have no price, O-022) and the largest files, with bulk delete and restore. Prices and sizes are the API's only.
 */
export async function StorageView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.subscription.storage");
  const sub = await getTranslations("owner.subscription");
  const { api, locale, me } = context;
  const mode = param(searchParams.files) === "deleted" ? "deleted" : "active";
  const page = pageParam(searchParams.page);
  const [storage, packages, files] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/storage"))),
    section(unwrap(api.GET("/v1/owner/storage/packages"))),
    section(
      unwrap(
        api.GET("/v1/owner/storage/files", {
          params: { query: { state: mode, sort: "size", order: "desc", page, perPage: PER_PAGE } },
        }),
      ),
    ),
  ]);
  const canManage = ownerCan(me, "tenant.subscription.manage") && !readOnly(me);
  const base = ownerPath(locale, "/subscription/storage");

  return (
    <OwnerPage testId="storage-page">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        crumbs={[{ label: sub("title"), href: ownerPath(locale, "/subscription") }, { label: t("page.title") }]}
      />

      <StorageBanner storage={storage.data ?? null} />

      <StorageCard storage={storage.data ?? null} error={storage.error} locale={locale} />

      <Card as="section" aria-labelledby="storage-packages" data-testid="storage-packages">
        <CardHeader
          title={<span id="storage-packages">{t("packages.title")}</span>}
          description={t("packages.description")}
        />
        {!packages.data ? (
          <SectionError error={packages.error} />
        ) : (
          <div className="flex flex-col gap-6">
            {packages.data.packages.length ? (
              <section aria-labelledby="storage-mine" className="flex flex-col gap-3">
                <h3 id="storage-mine" className="text-sm font-semibold">
                  {t("packages.mine")}
                </h3>
                <ul className="divide-border m-0 list-none divide-y p-0">
                  {packages.data.packages.map((pack) => (
                    <OwnedPackage key={pack.id} pack={pack} context={context} canManage={canManage} />
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="storage-offers" className="flex flex-col gap-3">
              <h3 id="storage-offers" className="text-sm font-semibold">
                {t("packages.offers")}
              </h3>
              {packages.data.offers.length === 0 ? (
                <EmptyState
                  icon={IconPackageCheck}
                  title={t("packages.noOffers")}
                  description={t("packages.noOffersHint")}
                />
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                  {packages.data.offers.map((offer) => {
                    const name = locale === "th" ? offer.nameTh : offer.nameEn;
                    const pending = packages.data!.packages.some(
                      (pack) => pack.packageId === offer.id && pack.state === "pending_payment",
                    );
                    return (
                      <li
                        key={offer.id}
                        className="rounded-card border-border flex flex-col gap-3 border p-4"
                        data-testid="storage-offer"
                        data-key={offer.key}
                        data-on-sale={offer.onSale}
                      >
                        <span className="flex flex-col gap-1">
                          <span className="font-semibold">{name}</span>
                          <span className="text-2xl font-semibold tabular-nums">
                            {t("packages.size", { size: formatBytes(offer.sizeBytes, locale) })}
                          </span>
                        </span>
                        {offer.onSale && offer.total && offer.price ? (
                          <>
                            <span className="flex flex-col">
                              <span className="font-semibold tabular-nums" data-testid="storage-offer-price">
                                {t("packages.price", {
                                  total: formatTHB(offer.total, locale),
                                  period: t(`packages.period.${offer.period}`),
                                })}
                              </span>
                              <span className="text-muted text-xs">
                                {t("packages.priceVat", { price: formatTHB(offer.price, locale) })}
                              </span>
                            </span>
                            {pending ? (
                              <Badge tone="warning" size="sm">
                                {t("packages.ownedPending")}
                              </Badge>
                            ) : canManage ? (
                              <span>
                                <BuyStoragePackage
                                  packageId={offer.id}
                                  name={name}
                                  size={formatBytes(offer.sizeBytes, locale)}
                                  period={t(`packages.period.${offer.period}`)}
                                  total={formatTHB(offer.total, locale)}
                                />
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="flex flex-col gap-1" data-testid="storage-offer-unpriced">
                            <span>
                              <Badge tone="neutral" size="sm">
                                {t("packages.unpriced")}
                              </Badge>
                            </span>
                            <span className="text-muted text-sm">{t("packages.unpricedHint")}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="storage-files-title" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="storage-files-title">{t("files.title")}</span>}
          description={t("files.description")}
        />
        <LinkTabs
          label={t("files.title")}
          current={mode === "deleted" ? `${base}?files=deleted` : base}
          tabs={[
            { href: base, label: t("files.tabs.active"), testId: "storage-tab-active" },
            { href: `${base}?files=deleted`, label: t("files.tabs.deleted"), testId: "storage-tab-deleted" },
          ]}
        />
        {!files.data ? (
          <SectionError error={files.error} />
        ) : files.data.data.length === 0 ? (
          <EmptyState icon={IconArchive} title={t(`files.empty.${mode}`)} />
        ) : (
          <>
            <StorageFilesTable
              key={`${mode}-${page}`}
              mode={mode}
              canManage={canManage}
              locale={locale}
              rows={files.data.data.map((file) => ({
                file,
                added: formatDate(file.createdAt, locale),
                until:
                  mode === "deleted"
                    ? file.purgeAfter
                      ? formatDate(file.purgeAfter, locale)
                      : null
                    : file.retainUntil
                      ? formatDate(file.retainUntil, locale)
                      : null,
              }))}
            />
            <ListPagination
              meta={files.data.meta}
              path={base}
              searchParams={mode === "deleted" ? { ...searchParams, files: "deleted" } : searchParams}
              locale={locale}
            />
          </>
        )}
      </Card>
    </OwnerPage>
  );
}

async function OwnedPackage({
  pack,
  context,
  canManage,
}: {
  pack: Schemas["OwnerStoragePackageDto"];
  context: OwnerContext;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.subscription.storage.packages");
  const { locale } = context;
  const live = pack.state === "active" || pack.state === "pending_payment";
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-4 py-3"
      data-testid="storage-package"
      data-state={pack.state}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{pack.name}</span>
          <StatusBadgeOf map={STORAGE_PACKAGE_STATUS} value={pack.state} size="sm" />
        </span>
        <span className="text-muted text-sm tabular-nums">
          {t("size", { size: formatBytes(pack.sizeBytes, locale) })} ·{" "}
          {t("price", { total: formatTHB(pack.price, locale), period: t(`period.${pack.period}`) })}
        </span>
        <span className="text-muted text-sm">
          {pack.startsOn && pack.endsOn
            ? t("runs", { from: formatDate(pack.startsOn, locale), to: formatDate(pack.endsOn, locale) })
            : pack.state === "pending_payment"
              ? t("waiting")
              : null}
        </span>
        {pack.invoice ? (
          <a
            href={ownerPath(locale, `/subscription/invoices/${pack.invoice.id}`)}
            className="text-primary text-sm font-medium hover:underline"
            data-testid="storage-package-invoice"
          >
            {t("invoice", { number: pack.invoice.number })}
          </a>
        ) : null}
      </span>
      {live ? <StorageAutoRenew storagePackageId={pack.id} autoRenew={pack.autoRenew} disabled={!canManage} /> : null}
    </li>
  );
}
