"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { MobileActionBar, StickySave } from "@/ui/components/FormLayout";
import { toast } from "@/ui/components/Toast";

type Channel = Schemas["NotificationChannel"];

export interface MatrixRow {
  eventType: string;
  label: string;
  description?: string;
  urgent: boolean;
  overridden: boolean;
  routes: Partial<Record<Channel, Schemas["NotificationRouteDto"]>>;
}

const key = (eventType: string, channel: Channel) => `${eventType}|${channel}`;

/**
 * The resident messages × channels matrix (`PUT /v1/owner/notification-routes`, D-063; redesign G6): a checkbox per
 * message and channel, changes collected and saved together from the sticky bar ("เปลี่ยน 2 รายการ · ยกเลิก ·
 * บันทึก"). The API may refuse to silence an urgent message on every channel — its problem is shown above the bar.
 */
export function NotificationMatrix({
  rows,
  channels,
  channelLabels,
  editable,
}: {
  rows: MatrixRow[];
  channels: Channel[];
  /** Column headings, with an optional one-line note under one (SMS is charged per message). */
  channelLabels: Partial<Record<Channel, { label: string; note?: string }>>;
  editable: boolean;
}) {
  const t = useTranslations("owner.settings.notifications");
  const common = useTranslations("common");
  const router = useRouter();
  const saved = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of rows)
      for (const channel of channels) {
        const route = row.routes[channel];
        if (route) map.set(key(row.eventType, channel), route.enabled);
      }
    return map;
  }, [rows, channels]);
  const [draft, setDraft] = useState<Map<string, boolean>>(() => new Map(saved));
  const [base, setBase] = useState(saved);
  const action = useApiAction({ refresh: false });
  const changed = [...draft].filter(([id, enabled]) => base.get(id) !== enabled);

  const save = () =>
    void action.run(
      async () => {
        // One PUT per changed cell, one after another: an urgent message refused on its last channel stops the rest.
        for (const [id, enabled] of changed) {
          const [eventType, channel] = id.split("|") as [string, Channel];
          await unwrap(
            browserApi().PUT("/v1/owner/notification-routes", {
              body: { audience: "resident", channel, eventType, enabled },
            }),
          );
        }
      },
      () => {
        setBase(new Map(draft));
        toast.success(t("saved"));
        router.refresh();
      },
    );

  const status = changed.length === 0 ? t("noChanges") : t("changes", { count: changed.length });

  return (
    <div className="flex flex-col">
      <table className="w-full text-base max-md:block" data-testid="route-matrix">
        <caption className="sr-only">{t("title")}</caption>
        <thead className="max-md:sr-only">
          <tr className="border-border text-muted border-b">
            <th scope="col" className="px-6 py-3 text-start text-sm font-medium">
              {t("col.event")}
            </th>
            {channels.map((channel) => (
              <th key={channel} scope="col" className="w-32 px-3 py-3 text-center text-sm font-medium">
                <span className="flex flex-col items-center">
                  <span>{channelLabels[channel]?.label ?? channel}</span>
                  {channelLabels[channel]?.note ? (
                    <span className="text-muted text-xs font-normal">{channelLabels[channel]!.note}</span>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map((row) => (
            <tr
              key={row.eventType}
              className="border-border border-b last:border-b-0 max-md:flex max-md:flex-wrap max-md:gap-x-6 max-md:gap-y-1 max-md:px-5 max-md:py-4"
              data-testid="route-row"
              data-event={row.eventType}
            >
              <th
                scope="row"
                className="px-6 py-4 text-start align-top font-normal max-md:w-full max-md:p-0 max-md:pb-1"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    {row.urgent ? (
                      <Badge size="sm" tone="warning">
                        {t("urgent")}
                      </Badge>
                    ) : null}
                  </span>
                  {row.description ? <span className="text-muted text-sm">{row.description}</span> : null}
                  {row.overridden ? <span className="text-muted text-sm">{t("overridden")}</span> : null}
                </span>
              </th>
              {channels.map((channel) => {
                const route = row.routes[channel];
                const id = key(row.eventType, channel);
                const label = channelLabels[channel]?.label ?? channel;
                return (
                  <td
                    key={channel}
                    className="px-3 py-4 text-center align-top max-md:inline-block max-md:p-0 max-md:text-start"
                  >
                    {route ? (
                      <span className="inline-flex justify-center max-md:min-h-11 max-md:items-center">
                        <Checkbox
                          label={
                            <span className="md:sr-only">
                              <span className="md:hidden">{label}</span>
                              <span className="max-md:hidden">
                                {t("switchLabel", { event: row.label, channel: label })}
                              </span>
                            </span>
                          }
                          checked={draft.get(id) ?? false}
                          disabled={!editable || action.busy}
                          onCheckedChange={(next) => setDraft((current) => new Map(current).set(id, next === true))}
                          data-testid={`route-${row.eventType}-${channel}`}
                          className="max-md:gap-2 md:gap-0"
                        />
                      </span>
                    ) : (
                      <span className="text-muted max-md:hidden">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{t("notAvailable")}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {action.error ? (
        <div className="border-border border-t px-5 py-3 md:px-6">
          <ProblemNotice error={action.error} />
        </div>
      ) : null}
      {editable ? (
        <>
          <StickySave status={status} className="rounded-b-card mx-0 md:mx-0">
            <Button
              variant="ghost"
              disabled={changed.length === 0 || action.busy}
              onClick={() => setDraft(new Map(base))}
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={save}
              disabled={changed.length === 0}
              loading={action.busy}
              data-testid="notifications-save"
            >
              {t("save")}
            </Button>
          </StickySave>
          <MobileActionBar summary={status}>
            <Button
              onClick={save}
              disabled={changed.length === 0}
              loading={action.busy}
              data-testid="notifications-save-phone"
            >
              {t("save")}
            </Button>
          </MobileActionBar>
        </>
      ) : null}
    </div>
  );
}
