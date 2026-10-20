import { getTranslations } from "next-intl/server";

import { DSR_STATUS, DSR_VALUES } from "@/domain/status/dsr";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { enumParam } from "@/features/shared/console/params";
import { ConsentSwitch, DsrActions } from "./PrivacyActions";
import { SettingsNav } from "./SettingsNav";

const OPEN: Schemas["DsrState"][] = ["received", "verifying", "in_progress"];

/** Still open after its legal due date (PDPA: 30 days, `dueAt` from the API). */
function isLate(dsr: Schemas["DsrDto"], now = Date.now()): boolean {
  return OPEN.includes(dsr.state) && new Date(dsr.dueAt).getTime() < now;
}

/**
 * Privacy (F2 2.6, PDPA, D-025, D-148): the operator's own consent purposes, and the DSR inbox — the
 * residents' requests to this tenant as controller, with their legal due date, the next step the API
 * offers and, once fulfilled, the export file for an access or portability request.
 */
export async function PrivacyView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.privacy");
  const { api, locale, me } = context;
  const state = enumParam(searchParams.state, DSR_VALUES);
  const [consents, dsrs] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/consents"))),
    section(unwrap(api.GET("/v1/owner/data-subject-requests", { params: { query: { state } } }))),
  ]);
  const manage = ownerCan(me, "privacy.manage") && !readOnly(me);
  return (
    <OwnerPage testId="privacy">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsNav me={me} current="/settings/privacy" locale={locale} />

      <Card as="section" aria-labelledby="privacy-consents" data-testid="consents">
        <CardHeader title={<span id="privacy-consents">{t("consents")}</span>} description={t("consentsHint")} />
        {!consents.data ? (
          <SectionError error={consents.error} />
        ) : consents.data.length === 0 ? (
          <EmptyState title={t("noConsents")} />
        ) : (
          <ul className="flex flex-col gap-4">
            {consents.data.map((purpose) => (
              <li
                key={purpose.key}
                className="border-border flex flex-col gap-2 border-b pb-4 last:border-b-0"
                data-testid="consent-row"
              >
                <ConsentSwitch purpose={purpose} language={me.user.language} />
                <details>
                  <summary className="text-primary cursor-pointer text-sm">
                    {t("readText", { version: purpose.version })}
                  </summary>
                  <p className="text-muted mt-2 text-sm whitespace-pre-wrap">{purpose.bodyMarkdown}</p>
                </details>
                {purpose.capturedAt ? (
                  <p className="text-muted text-xs">
                    {t("capturedAt", {
                      date: formatDateTime(purpose.capturedAt, locale),
                      version: purpose.grantedVersion ?? purpose.version,
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section aria-labelledby="privacy-dsr" className="flex flex-col gap-3" data-testid="dsr-inbox">
        <h2 id="privacy-dsr" className="text-lg font-semibold">
          {t("dsr.title")}
        </h2>
        <p className="text-muted text-sm">{t("dsr.description")}</p>
        <FilterBar
          fields={[
            {
              name: "state",
              label: t("dsr.state"),
              type: "select",
              placeholder: t("dsr.allStates"),
              options: DSR_VALUES.map((value) => ({ value, label: t(`dsr.stateName.${value}`) })),
            },
          ]}
        />
        {!dsrs.data ? (
          <SectionError error={dsrs.error} />
        ) : dsrs.data.length === 0 ? (
          <Card>
            <EmptyState title={t("dsr.empty")} />
          </Card>
        ) : (
          <SimpleTable
            caption={t("dsr.title")}
            testId="dsr-table"
            minWidth="60rem"
            columns={[
              { key: "received", header: t("dsr.col.received") },
              { key: "kind", header: t("dsr.col.kind") },
              { key: "due", header: t("dsr.col.due") },
              { key: "state", header: t("dsr.col.state") },
              { key: "result", header: t("dsr.col.result") },
              { key: "actions", header: <span className="sr-only">{t("dsr.col.actions")}</span> },
            ]}
            rows={dsrs.data.map((dsr) => {
              const late = isLate(dsr);
              return {
                key: dsr.id,
                testId: "dsr-row",
                data: { state: dsr.state, id: dsr.id },
                tone: late ? "danger" : "default",
                cells: {
                  received: (
                    <span className="flex flex-col">
                      <span>{formatDateTime(dsr.receivedAt, locale)}</span>
                      <span className="text-muted font-mono text-xs">{dsr.id.slice(0, 8)}</span>
                    </span>
                  ),
                  kind: t(`dsr.kind.${dsr.kind}`),
                  due: (
                    <span className="flex flex-col gap-1">
                      {formatDate(dsr.dueAt, locale)}
                      {late ? (
                        <Badge size="sm" tone="danger">
                          {t("dsr.late")}
                        </Badge>
                      ) : null}
                    </span>
                  ),
                  state: <StatusBadgeOf map={DSR_STATUS} value={dsr.state} size="sm" />,
                  result: (
                    <span className="flex flex-col gap-1 text-sm">
                      {dsr.notes ? <span>{dsr.notes}</span> : null}
                      {dsr.exportDocumentId ? (
                        <DocumentButton
                          document={{ kind: "file", id: dsr.exportDocumentId, purpose: "dsr_export" }}
                          label={t("dsr.export")}
                          title={t("dsr.exportTitle", { id: dsr.id.slice(0, 8) })}
                        />
                      ) : null}
                      {!dsr.notes && !dsr.exportDocumentId ? "—" : null}
                    </span>
                  ),
                  actions: manage ? <DsrActions dsr={dsr} /> : null,
                },
              };
            })}
          />
        )}
      </section>
    </OwnerPage>
  );
}
