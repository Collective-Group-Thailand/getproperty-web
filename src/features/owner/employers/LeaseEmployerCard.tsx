import { getTranslations } from "next-intl/server";

import { formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";

import { ownerPath } from "../shared/links";
import { section } from "../shared/server";
import { attachable } from "./employer";
import { LeaseEmployerActions } from "./EmployerForms";

const OPEN = new Set<Schemas["LeaseStatus"]>(["draft", "pending_signature", "active", "notice_given", "ending"]);

/**
 * "Who pays" on a lease (G8, D-299): the employer agreement the lease is attached to — its invoices are then
 * addressed to the employer — with attach / change / detach while the lease is open. Shown only when the tenant has
 * employer agreements; a lease never shows a relocation offer (that stays between the resident and getproperty).
 */
export async function LeaseEmployerCard({
  api,
  lease,
  locale,
  canManage,
}: {
  api: ApiClient;
  lease: Schemas["LeaseDto"];
  locale: Locale;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.network.employers.lease");
  const agreements = await section(unwrap(api.GET("/v1/owner/employer-agreements")));
  const all = agreements.data?.data ?? [];
  if (all.length === 0) return null;
  const current = all.find((agreement) => agreement.leaseIds.includes(lease.id)) ?? null;
  const options = all.filter((agreement) => agreement.id !== current?.id && attachable(agreement, lease));
  const label = (agreement: Schemas["EmployerAgreementDto"]) =>
    [agreement.employer.displayName, agreement.reference].filter(Boolean).join(" · ");
  return (
    <Card as="section" aria-labelledby="lease-employer" className="flex flex-col gap-3" data-testid="lease-employer">
      <CardHeader title={<span id="lease-employer">{t("title")}</span>} description={t("hint")} />
      {current ? (
        <p className="m-0 text-sm" data-testid="lease-employer-current">
          {t.rich("current", {
            name: current.employer.displayName,
            percent: formatPercent(current.deductPercent, locale),
            link: (chunks) => (
              <a
                className="text-primary font-medium underline-offset-4 hover:underline"
                href={ownerPath(locale, `/employers/${current.id}`)}
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      ) : (
        <p className="text-muted m-0 text-sm">{t("lessee", { name: lease.lesseeName ?? "—" })}</p>
      )}
      {canManage && OPEN.has(lease.status) ? (
        <LeaseEmployerActions
          leaseId={lease.id}
          current={current ? { id: current.id, name: label(current) } : null}
          options={options.map((agreement) => ({ id: agreement.id, name: label(agreement) }))}
        />
      ) : null}
    </Card>
  );
}
