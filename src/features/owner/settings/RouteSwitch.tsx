"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

/**
 * One cell of the notification routing matrix (`PUT /v1/owner/notification-routes`): turns a channel on
 * or off for one resident-facing event; takes effect at once (a switch, design-system.md §3). The API
 * may refuse to silence an urgent event on every channel — its problem is shown under the switch.
 */
export function RouteSwitch({
  route,
  label,
  disabled,
}: {
  route: Schemas["NotificationRouteDto"];
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations("owner.settings.notifications");
  const [enabled, setEnabled] = useState(route.enabled);
  const action = useApiAction({ refresh: false });
  return (
    <div className="flex flex-col items-center gap-1">
      <Switch
        label={<span className="sr-only">{label}</span>}
        checked={enabled}
        disabled={disabled || action.busy}
        data-testid={`route-${route.eventType}-${route.channel}`}
        onCheckedChange={(next) => {
          setEnabled(next);
          void action.run(
            () =>
              unwrap(
                browserApi().PUT("/v1/owner/notification-routes", {
                  body: { audience: "resident", channel: route.channel, eventType: route.eventType, enabled: next },
                }),
              ),
            () => {
              toast.success(next ? t("turnedOn") : t("turnedOff"));
            },
          );
        }}
      />
      {action.error ? (
        <span className="max-w-48 text-start">
          <ProblemNotice error={action.error} />
        </span>
      ) : null}
    </div>
  );
}
