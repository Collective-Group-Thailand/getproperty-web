import { getTranslations } from "next-intl/server";

import { formatNumber } from "@/i18n/format";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";

import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "../shared/PageHeader";
import type { OwnerContext } from "../shared/server";
import { NewBuildingButton, NewPropertyButton } from "./forms";

/** Properties and their buildings (F2 2.1, D-151: property → building → floor → unit). */
export async function BuildingsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.buildings");
  const { locale, properties, buildings } = context;
  return (
    <OwnerPage testId="buildings">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <NewPropertyButton />
            <NewBuildingButton properties={properties.map(({ id, name }) => ({ id, name }))} />
          </>
        }
      />
      {properties.length === 0 ? (
        <Card>
          <EmptyState icon={IconBuilding} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        properties.map((property) => {
          const own = buildings.filter((building) => building.propertyId === property.id);
          return (
            <section
              key={property.id}
              aria-labelledby={`property-${property.id}`}
              className="flex flex-col gap-3"
              data-testid="property"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 id={`property-${property.id}`} className="text-lg font-semibold">
                  {property.name}
                </h2>
                <span className="text-muted font-mono text-sm">{property.code}</span>
                {property.address ? (
                  <span className="text-muted text-sm">
                    {[property.address.line1, property.address.district, property.address.province]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                ) : null}
              </div>
              {own.length === 0 ? (
                <p className="text-muted text-sm">{t("noBuildings")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {own.map((building) => (
                    <li key={building.id}>
                      <a
                        href={ownerPath(locale, `/buildings/${building.id}`)}
                        className="rounded-card border-border bg-surface shadow-card hover:shadow-raised flex items-center gap-3 border p-4 transition-shadow"
                        data-testid="building-card"
                      >
                        <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-11 items-center justify-center">
                          <Icon icon={IconBuilding} size={22} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">{building.name}</span>
                          <span className="text-muted text-sm">
                            {t("cardMeta", {
                              type: t(`type.${building.type}`),
                              units: formatNumber(building.unitCount, locale),
                              floors: building.floorsCount ?? 0,
                            })}
                          </span>
                        </span>
                        {building.access !== "operator" ? (
                          <Badge tone="info" size="sm">
                            {t(`access.${building.access}`)}
                          </Badge>
                        ) : null}
                        <Icon icon={IconChevronRight} className="text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </OwnerPage>
  );
}
