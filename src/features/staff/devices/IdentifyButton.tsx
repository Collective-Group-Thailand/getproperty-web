"use client";

import { COMMAND_STATUS } from "@/domain/status/command";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import type { IconGlyph } from "@/ui/icons";
import { IconIdentify } from "@/ui/icons/glyphs/identify";

const FINAL = new Set<Schemas["CommandStatus"]>(["done", "failed", "expired"]);
const SECONDS = 30;

/**
 * "Which box is it?" — the gateway's `identify` command blinks its LED for 30 s (D-131; no command can
 * cut power or lock anyone out, D-024).
 */
export function IdentifyButton({ gatewayId }: { gatewayId: string }) {
  const t = useTranslations("staff.devices.identify");
  return (
    <CommandButton
      gatewayId={gatewayId}
      type="identify"
      args={{ seconds: SECONDS }}
      label={t("action", { seconds: SECONDS })}
      icon={IconIdentify}
      testId="identify"
    />
  );
}

/** Sends one operator command to a gateway and follows its acknowledgement until it is final. */
export function CommandButton({
  gatewayId,
  type,
  args = {},
  label,
  icon,
  testId,
}: {
  gatewayId: string;
  type: Schemas["OperatorCommandType"];
  args?: Record<string, unknown>;
  label: string;
  icon: IconGlyph;
  testId: string;
}) {
  const t = useTranslations("staff.devices.identify");
  const [command, setCommand] = useState<Schemas["DeviceCommandDto"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!command || FINAL.has(command.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const list = await unwrap(
          browserApi().GET("/v1/staff/devices/{deviceId}/commands", { params: { path: { deviceId: gatewayId } } }),
        );
        const latest = list.find((candidate) => candidate.id === command.id);
        if (latest) setCommand(latest);
      } catch {
        // try again on the next tick
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [command, gatewayId]);

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <Button
        variant="secondary"
        size="xl"
        block
        iconStart={icon}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setCommand(
              await unwrap(
                browserApi().POST("/v1/staff/devices/{deviceId}/commands", {
                  params: { path: { deviceId: gatewayId } },
                  body: { type, args },
                }),
              ),
            );
          } catch (failure) {
            setError(isApiError(failure) ? failure.detail || failure.code : t("offline"));
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {command ? (
        <p
          className="flex items-center gap-2 text-sm"
          role="status"
          data-testid={`${testId}-status`}
          data-status={command.status}
        >
          {t("status")} <StatusBadgeOf map={COMMAND_STATUS} value={command.status} size="sm" />
        </p>
      ) : null}
      {error ? (
        <Callout tone="danger">
          <span role="alert">{error}</span>
        </Callout>
      ) : null}
    </div>
  );
}
