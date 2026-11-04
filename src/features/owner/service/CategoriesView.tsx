import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { Badge } from "@/ui/components/Badge";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { EditCategory, InlineSlaHours, NewCategory, ResetCategory } from "./CategoryActions";
import { categoryName, serviceCategories } from "./server";

/**
 * Service categories and their SLA hours (F2 2.7, D-072, D-159, D-210; G4): one table — the category, its SLA edited
 * in place, where the hours come from (the platform's default, or the organisation's own with a way back to the
 * default) and the full edit. A request keeps the hours in force when it was reported.
 */
export async function CategoriesView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.service.categories");
  const { api, locale, me } = context;
  const categories = await serviceCategories(api, true);
  const canManage = ownerCan(me, "service_category.manage") && !readOnly(me);
  return (
    <OwnerPage testId="service-categories">
      <PageHeader title={t("title")} description={t("description")} actions={canManage ? <NewCategory /> : null} />
      <SimpleTable
        caption={t("title")}
        testId="category-table"
        stackOnPhones
        minWidth="44rem"
        columns={[
          { key: "name", header: t("name"), phone: "title" },
          { key: "sla", header: t("sla"), align: "end", phone: "figure", className: "md:w-72" },
          { key: "source", header: t("source"), phone: "meta", className: "md:w-64" },
          {
            key: "actions",
            header: <span className="sr-only">{t("actions")}</span>,
            phone: "status",
            className: "md:w-16",
          },
        ]}
        rows={categories.map((category) => ({
          key: category.id,
          testId: "category-row",
          data: { key: category.key, source: category.source },
          cells: {
            name: (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{categoryName(category, locale)}</span>
                {category.isActive ? null : (
                  <Badge tone="neutral" size="sm">
                    {t("inactive")}
                  </Badge>
                )}
              </span>
            ),
            sla: <InlineSlaHours category={category} canManage={canManage} />,
            source: (
              <span className="flex flex-wrap items-center gap-2">
                {category.source === "tenant" ? (
                  <Badge tone="primary" size="sm" icon={IconEdit}>
                    {t("sourceValue.tenant")}
                  </Badge>
                ) : (
                  <span className="text-muted text-sm">{t("sourceValue.platform")}</span>
                )}
                {canManage && category.source === "tenant" ? <ResetCategory category={category} /> : null}
              </span>
            ),
            actions: canManage ? <EditCategory category={category} /> : null,
          },
        }))}
      />
      <p className="text-muted text-sm">{t("listHint")}</p>
    </OwnerPage>
  );
}
