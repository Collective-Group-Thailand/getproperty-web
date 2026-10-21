import { useTranslations } from "next-intl";

import { Badge } from "@/ui/components/Badge";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconWarning } from "@/ui/icons/glyphs/warning";

/**
 * How a gateway may reach the broker (`FleetDeviceDto.mqttWsFallback`, D-239): MQTT over TLS on 8883 with its
 * client certificate (the default), or also the WebSocket fallback with its device JWT alone — shown as a
 * warning, never colour alone (icon + text). Works in server and client components.
 */
export function MqttTransportBadge({ enabled, size }: { enabled: boolean; size?: "sm" | "md" }) {
  const t = useTranslations("glossary.mqttTransport");
  return enabled ? (
    <span data-testid="mqtt-transport" data-ws-fallback="true">
      <Badge tone="warning" icon={IconWarning} size={size}>
        {t("wsFallback")}
      </Badge>
    </span>
  ) : (
    <span data-testid="mqtt-transport" data-ws-fallback="false">
      <Badge tone="neutral" icon={IconLock} size={size}>
        {t("mtlsOnly")}
      </Badge>
    </span>
  );
}
