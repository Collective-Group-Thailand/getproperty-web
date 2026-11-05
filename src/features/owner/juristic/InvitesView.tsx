import { getTranslations } from "next-intl/server";

import { vocabularyKeys } from "@/domain/juristic/vocabulary";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLock } from "@/ui/icons/glyphs/lock";

import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { InviteSheet, type InviteCandidate } from "./InviteSheet";
import { juristicScope } from "./scope";

/**
 * Resident invite codes in a batch (JR, D-309): one code per current co-owner of the chosen units, created through the
 * API (shown once, never stored in clear) and printed as a sheet of QR cards — for owners not yet on LINE, posted
 * with the statement or handed over at the office.
 */
export async function InvitesView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.juristic");
  const { api, locale, me } = context;
  const scope = juristicScope(context, searchParams);
  const words = vocabularyKeys(scope.kind);
  const back = withQuery(ownerPath(locale, "/juristic/register"), { building: scope.building?.id });
  const allowed = !readOnly(me) && ownerCan(me, "juristic.register.manage");
  const list =
    scope.building && allowed
      ? await section(
          unwrap(
            api.GET("/v1/owner/juristic/register", {
              params: { query: { buildingId: scope.building.id, perPage: 100 } },
            }),
          ),
        )
      : null;
  const candidates: InviteCandidate[] = (list?.data?.data ?? []).flatMap((row) =>
    row.owners.map((owner) => ({
      key: `${row.unitId}:${owner.party.id}`,
      unitId: row.unitId,
      unitNo: row.unitNo,
      partyId: owner.party.id,
      name: owner.party.displayName,
      linked: owner.party.residentLinked,
    })),
  );
  return (
    <OwnerPage testId="juristic-invites">
      <PageHeader
        title={t("invites.title")}
        description={t("invites.lede", { group: scope.building?.name ?? "", units: t(words.units) })}
        back={{ label: t("register.title"), href: back }}
      />
      {!allowed ? (
        <EmptyState
          variant="card"
          icon={IconLock}
          title={t("transfer.notAllowedTitle")}
          description={t("invites.notAllowed")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{t("invites.back")}</a>
            </Button>
          }
        />
      ) : list && !list.data ? (
        <SectionError error={list.error} />
      ) : (
        <InviteSheet
          candidates={candidates}
          office={me.currentTenant?.displayName ?? ""}
          unitWord={t(words.unit)}
          backHref={back}
        />
      )}
    </OwnerPage>
  );
}
