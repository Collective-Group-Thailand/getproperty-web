"use client";

import { useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { IconIdentify } from "@/ui/icons/glyphs/identify";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";

const OFFERED: { action: string; type: Schemas["OperatorCommandType"] }[] = [
  { action: "identify", type: "identify" },
  { action: "read-now", type: "read_now" },
];

/**
 * The commands an operator may send a gateway (D-183, read-mostly): "identify" (blink to find it on the
 * wall) and "read now" — only those `nextActions` lists. Restart and log upload stay with the platform.
 */
export function DeviceCommands({ device }: { device: Pick<Schemas["FleetDeviceDto"], "id" | "nextActions"> }) {
  const t = useTranslations("owner.devices.command");
  const action = useApiAction();
  const actions = new Set(device.nextActions.map((name) => name.replace(/_/g, "-")));
  const offered = OFFERED.filter((candidate) => actions.has(candidate.action));
  if (offered.length === 0) return null;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2" data-testid="device-commands">
        {offered.map((candidate) => (
          <Button
            key={candidate.type}
            variant="secondary"
            iconStart={candidate.type === "identify" ? IconIdentify : IconRefresh}
            loading={action.busy}
            onClick={() =>
              void action.run(() =>
                unwrap(
                  browserApi().POST("/v1/owner/devices/{deviceId}/commands", {
                    params: { path: { deviceId: device.id } },
                    body: { type: candidate.type },
                  }),
                ),
              )
            }
            data-testid={`command-${candidate.type}`}
          >
            {t(candidate.type)}
          </Button>
        ))}
      </div>
      <ProblemNotice error={action.error} />
    </div>
  );
}
