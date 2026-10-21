"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconWarning } from "@/ui/icons/glyphs/warning";

/** The API's bounds of `DeviceMqttTransportDto.reason` (3–500 characters). */
export const TRANSPORT_REASON_MIN = 3;
export const TRANSPORT_REASON_MAX = 500;

/** The risks of the WebSocket path the founder accepted (getproperty-api ADR-0015, D-239), in the order of the ADR. */
export const WS_FALLBACK_RISKS = ["jwtAlone", "noBinding", "blastRadius", "mitigation"] as const;

/**
 * `POST /v1/admin/devices/{deviceId}/actions/set-mqtt-transport` (D-239, offered as `set-mqtt-transport` in the
 * gateway's `nextActions`): switches the gateway's MQTT WebSocket fallback — EMQX ws behind Caddy with the
 * device JWT **alone**, no client certificate. Turning it on states the accepted risks of ADR-0015 in the
 * dialog; turning it off says the next WebSocket connect is refused. Both are typed with the serial and need
 * a reason (audited); one Idempotency-Key per opening of the dialog.
 */
export function MqttTransportAction({ device }: { device: Schemas["FleetDeviceDto"] }) {
  const t = useTranslations("admin.fleet.transport");
  const [reason, setReason] = useState("");
  const enable = !device.mqttWsFallback;
  const trimmed = reason.trim();
  return (
    <ConfirmAction
      label={enable ? t("enable") : t("disable")}
      icon={enable ? IconWarning : IconLock}
      variant={enable ? "destructive" : "secondary"}
      tone={enable ? "destructive" : "primary"}
      testId="set-mqtt-transport"
      title={enable ? t("enableTitle", { serial: device.serial }) : t("disableTitle", { serial: device.serial })}
      description={enable ? t("enableBody") : t("disableBody")}
      confirmLabel={enable ? t("enableConfirm") : t("disableConfirm")}
      phrase={device.serial}
      ready={trimmed.length >= TRANSPORT_REASON_MIN && trimmed.length <= TRANSPORT_REASON_MAX}
      successMessage={enable ? t("enabled") : t("disabled")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/admin/devices/{deviceId}/actions/set-mqtt-transport", {
            params: { path: { deviceId: device.id }, header: { "Idempotency-Key": key } },
            body: { wsFallback: enable, reason: trimmed },
          }),
        )
      }
    >
      {enable ? (
        <div data-testid="transport-risks">
          <Callout tone="warning" title={t("risksTitle")}>
            <ul className="list-disc ps-5 text-sm">
              {WS_FALLBACK_RISKS.map((risk) => (
                <li key={risk}>{t(`risk.${risk}`)}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs opacity-90">{t("risksRef")}</p>
          </Callout>
        </div>
      ) : null}
      <Field label={t("reason")} required hint={t("reasonHint")}>
        <Textarea
          rows={2}
          maxLength={TRANSPORT_REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid="transport-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
