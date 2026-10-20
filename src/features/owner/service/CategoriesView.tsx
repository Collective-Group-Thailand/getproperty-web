import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { EditCategory, NewCategory, ResetCategory } from "./CategoryActions";
import { categoryName, serviceCategories } from "./server";
import { ServiceNav } from "./ServiceNav";

/**
 * Service categories and their SLA hours (F2 2.7, D-072, D-159, D-210): the platform's defaults and the
 * tenant's overrides side by side; a request keeps the hours in force when it was reported.
 */
export async function CategoriesView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.service.categories");
  const { api, locale, me } = context;
  const categories = await serviceCategories(api, true);
  const canManage = ownerCan(me, "service_category.manage") && !readOnly(me);
  return (
    <OwnerPage testId="service-categories">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={canManage ? <NewCategory /> : null}
      />
      <ServiceNav current="/service-categories" locale={locale} />
      <Card>
        <CardHeader title={t("listTitle")} description={t("listHint")} />
        <SimpleTable
          caption={t("title")}
          testId="category-table"
          columns={[
            { key: "name", header: t("name") },
            { key: "sla", header: t("slaHours"), align: "end" },
            { key: "source", header: t("source") },
            { key: "actions", header: <span className="sr-only">{t("actions")}</span> },
          ]}
          rows={categories.map((category) => ({
            key: category.id,
            testId: "category-row",
            data: { key: category.key, source: category.source },
            cells: {
              name: (
                <span className="flex flex-col">
                  <span className="font-medium">{categoryName(category, locale)}</span>
                  <span className="text-muted font-mono text-xs">{category.key}</span>
                </span>
              ),
              sla: <span data-testid="category-hours">{t("hours", { hours: category.slaHours })}</span>,
              source: (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={category.source === "tenant" ? "primary" : "neutral"} size="sm">
                    {t(`sourceValue.${category.source}`)}
                  </Badge>
                  {category.isActive ? null : (
                    <Badge tone="neutral" size="sm">
                      {t("inactive")}
                    </Badge>
                  )}
                </span>
              ),
              actions: canManage ? (
                <span className="flex justify-end gap-1">
                  <EditCategory category={category} />
                  {category.source === "tenant" ? <ResetCategory category={category} /> : null}
                </span>
              ) : null,
            },
          }))}
        />
      </Card>
    </OwnerPage>
  );
}
