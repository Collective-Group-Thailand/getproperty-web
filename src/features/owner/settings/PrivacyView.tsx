import { getTranslations } from "next-intl/server";

import { DSR_STATUS, DSR_VALUES } from "@/domain/status/dsr";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { enumParam } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { ConsentSwitch, DsrActions } from "./PrivacyActions";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

const OPEN: Schemas["DsrState"][] = ["received", "verifying", "in_progress"];

/** Still open after its legal due date (PDPA: 30 days, `dueAt` from the API). */
function isLate(dsr: Schemas["DsrDto"], now: number): boolean {
  return OPEN.includes(dsr.state) && new Date(dsr.dueAt).getTime() < now;
}

/**
 * Settings › Privacy (F2 2.6, PDPA, D-025, D-148; redesign G6): the operator's own consents — one row per purpose,
 * required or optional, its version and when it was given — and the residents' requests to this tenant as controller,
 * with the legal due date (overdue in words and an icon), the next step as the row's one visible action and refusing
 * in its "⋯"; once fulfilled, the export file of an access or portability request.
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
  const now = currentTime();
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/privacy"
      title={t("title")}
      description={t("description")}
      testId="privacy"
    >
      <SettingsCard
        number={1}
        id="privacy-consents"
        testId="consents"
        title={t("consents")}
        description={t("consentsHint")}
        flush
      >
        {!consents.data ? (
          <div className="p-5 md:p-6">
            <SectionError error={consents.error} />
          </div>
        ) : consents.data.length === 0 ? (
          <EmptyState
            icon={IconShield}
            title={t("noConsents")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/privacy")}>{t("readNotice")}</a>
              </Button>
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {consents.data.map((purpose) => (
              <li key={purpose.key} className="flex flex-col gap-2 px-5 py-4 md:px-6" data-testid="consent-row">
                <ConsentSwitch purpose={purpose} language={me.user.language} />
                <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>
                    {purpose.capturedAt
                      ? t("capturedAt", {
                          date: formatDateTime(purpose.capturedAt, locale),
                          version: purpose.grantedVersion ?? purpose.version,
                        })
                      : t("versionOnly", { version: purpose.version })}
                  </span>
                  <details className="group">
                    <summary className="text-primary cursor-pointer font-medium">
                      {t("readText", { version: purpose.version })}
                    </summary>
                    <p className="text-muted mt-2 max-w-prose text-sm whitespace-pre-wrap">{purpose.bodyMarkdown}</p>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard
        number={2}
        id="privacy-dsr"
        testId="dsr-inbox"
        title={t("dsr.title")}
        description={t("dsr.description")}
        action={
          <FilterBar
            variant="toolbar"
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
        }
        flush
      >
        {!dsrs.data ? (
          <div className="p-5 md:p-6">
            <SectionError error={dsrs.error} />
          </div>
        ) : dsrs.data.length === 0 ? (
          <EmptyState
            icon={IconShield}
            title={state ? t("dsr.emptyFiltered") : t("dsr.empty")}
            description={state ? undefined : t("dsr.emptyHint")}
            action={
              state ? (
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/settings/privacy")}>{t("dsr.clear")}</a>
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/settings/audit-log")}>{t("dsr.openAudit")}</a>
                </Button>
              )
            }
          />
        ) : (
          <SimpleTable
            caption={t("dsr.title")}
            testId="dsr-table"
            minWidth="50rem"
            stackOnPhones
            className="rounded-none border-0 shadow-none"
            columns={[
              { key: "kind", header: t("dsr.col.kind"), phone: "title" },
              { key: "received", header: t("dsr.col.received"), className: "whitespace-nowrap", phone: "meta" },
              { key: "due", header: t("dsr.col.due"), className: "whitespace-nowrap", phone: "meta" },
              { key: "state", header: t("dsr.col.state"), className: "whitespace-nowrap", phone: "status" },
              { key: "result", header: t("dsr.col.result"), phone: "meta" },
              {
                key: "actions",
                header: <span className="sr-only">{t("dsr.col.actions")}</span>,
                align: "end",
                phone: "figure",
              },
            ]}
            rows={dsrs.data.map((dsr) => {
              const late = isLate(dsr, now);
              return {
                key: dsr.id,
                testId: "dsr-row",
                data: { state: dsr.state, id: dsr.id },
                cells: {
                  kind: <span className="font-medium">{t(`dsr.kind.${dsr.kind}`)}</span>,
                  received: formatDateTime(dsr.receivedAt, locale),
                  due: late ? (
                    <StatusText tone="danger" icon={IconAlert} detail={formatDate(dsr.dueAt, locale)}>
                      {t("dsr.late")}
                    </StatusText>
                  ) : (
                    formatDate(dsr.dueAt, locale)
                  ),
                  state: <StatusBadgeOf map={DSR_STATUS} value={dsr.state} size="sm" />,
                  result: (
                    <span className="flex flex-col items-start gap-1 text-sm">
                      {dsr.notes ? <span>{dsr.notes}</span> : null}
                      {dsr.exportDocumentId ? (
                        <DocumentButton
                          document={{ kind: "file", id: dsr.exportDocumentId, purpose: "dsr_export" }}
                          label={t("dsr.export")}
                          title={t("dsr.exportTitle", { kind: t(`dsr.kind.${dsr.kind}`) })}
                        />
                      ) : null}
                      {!dsr.notes && !dsr.exportDocumentId ? <span className="text-muted">—</span> : null}
                    </span>
                  ),
                  actions: manage ? <DsrActions dsr={dsr} /> : "",
                },
              };
            })}
          />
        )}
      </SettingsCard>
    </SettingsFrame>
  );
}
