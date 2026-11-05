import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { kindOf, vocabularyKeys } from "@/domain/juristic/vocabulary";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLock } from "@/ui/icons/glyphs/lock";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { TransferWizard } from "./TransferWizard";

/** The whole-unit transfer page (JW1a): the wizard with the unit, its sellers and the tenant's people to pick from. */
export async function TransferView({ context, unitId }: { context: OwnerContext; unitId: string }) {
  const t = await getTranslations("owner.juristic");
  const { api, locale, me } = context;
  let unit: Schemas["RegisterUnitDetailDto"];
  try {
    unit = await unwrap(api.GET("/v1/owner/juristic/register/units/{unitId}", { params: { path: { unitId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const building = context.buildings.find((candidate) => candidate.id === unit.buildingId);
  const kind = kindOf(context.properties.find((candidate) => candidate.id === building?.propertyId));
  const unitWord = t(vocabularyKeys(kind).unit);
  const back = ownerPath(locale, `/juristic/register/${unit.unitId}`);
  const allowed = !readOnly(me) && ownerCan(me, "juristic.register.manage");
  const parties = allowed
    ? await section(unwrap(api.GET("/v1/owner/parties", { params: { query: { perPage: 100 } } })))
    : null;
  return (
    <OwnerPage testId="juristic-transfer">
      <PageHeader
        title={t("transfer.title", { unit: unitWord, no: unit.unitNo })}
        description={t("transfer.lede")}
        back={{ label: t("unit.title", { unit: unitWord, no: unit.unitNo }), href: back }}
      />
      {!allowed || unit.owners.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconLock}
          title={allowed ? t("transfer.noOwnersTitle") : t("transfer.notAllowedTitle")}
          description={allowed ? t("transfer.noOwners") : t("transfer.notAllowed")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{t("transfer.backToUnit")}</a>
            </Button>
          }
        />
      ) : (
        <TransferWizard
          unit={unit}
          unitWord={unitWord}
          registerHref={back}
          parties={(parties?.data?.data ?? []).map((party) => ({
            id: party.id,
            name: party.displayName,
            type: party.type,
          }))}
        />
      )}
    </OwnerPage>
  );
}
