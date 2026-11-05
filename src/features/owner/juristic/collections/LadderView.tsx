import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { FilterLinks } from "@/ui/components/ListToolbar";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { CollectionsNav } from "./CollectionsNav";
import { LadderSteps } from "./LadderEditor";

/**
 * The collection ladder (JW1b, J-DESIGN §4): one ladder per legal form of the office's buildings, each a vertical list
 * of steps counted in days from the due date of the oldest overdue bill. Reminders run as they are; every legal
 * measure waits for counsel (O-038) — locked with its reason from the API, never switchable around it.
 */
export async function LadderView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.collections");
  const { api, locale, me } = context;
  const ladders = await section(unwrap(api.GET("/v1/owner/juristic/collection-ladders")));
  const items = ladders.data?.items ?? [];
  const wanted = param(searchParams.form);
  const ladder = items.find((candidate) => candidate.legalForm === wanted) ?? items[0] ?? null;
  const base = ownerPath(locale, "/juristic/collections/settings");
  const canManage = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const locked = ladder ? ladder.steps.filter((step) => step.legalReviewRequired && !step.enabled).length : 0;

  return (
    <OwnerPage testId="juristic-ladder">
      <PageHeader title={t("ladder.title")} description={t("ladder.lede")} />
      <CollectionsNav current="ladder" locale={locale} />
      {!ladders.data ? (
        <SectionError error={ladders.error} />
      ) : !ladder ? (
        <EmptyState
          variant="card"
          icon={IconChecklist}
          title={t("ladder.emptyTitle")}
          description={t("ladder.empty")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/buildings")}>{t("ladder.emptyAction")}</a>
            </Button>
          }
        />
      ) : (
        <>
          {items.length > 1 ? (
            <FilterLinks
              label={t("ladder.forms")}
              current={ladder.legalForm}
              links={items.map((item) => ({
                key: item.legalForm,
                href: withQuery(base, { form: item.legalForm }),
                label: t(`legalForm.${item.legalForm}`),
                testId: `ladder-form-${item.legalForm}`,
              }))}
            />
          ) : null}
          {locked ? (
            <Callout tone="neutral" title={t("ladder.counselTitle", { count: locked })}>
              {t("ladder.counsel")}
            </Callout>
          ) : null}
          <Card as="section" aria-labelledby="ladder-title" className="flex flex-col gap-6">
            <CardHeader title={<span id="ladder-title">{ladder.name}</span>} description={t("ladder.cardHint")} />
            <LadderSteps ladder={ladder} canManage={canManage} officeName={me.currentTenant?.displayName ?? ""} />
          </Card>
        </>
      )}
    </OwnerPage>
  );
}
