import { useTranslations } from "next-intl";

import { deviceEventLabelKey } from "@/domain/deviceEvents";

/**
 * A device event's name (`DeviceEventDto.type`) in the reader's language — "มิเตอร์เปลี่ยนสถานะ" for
 * `meter_status_changed` — with its code beside it for the console's support staff (`showCode`). A type
 * the app does not know yet is shown as its code. Works in server and client components.
 */
export function DeviceEventName({ type, showCode = false }: { type: string; showCode?: boolean }) {
  const t = useTranslations();
  const key = deviceEventLabelKey(type);
  if (!key)
    return (
      <span className="font-mono text-xs" data-event-type={type}>
        {type}
      </span>
    );
  return (
    <span className="inline-flex flex-col" data-event-type={type}>
      <span className="font-medium">{t(key)}</span>
      {showCode ? <span className="text-muted font-mono text-xs">{type}</span> : null}
    </span>
  );
}
