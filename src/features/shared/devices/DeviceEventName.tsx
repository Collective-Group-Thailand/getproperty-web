import { useTranslations } from "next-intl";

import { deviceEventLabelKey } from "@/domain/deviceEvents";

/**
 * A device event's name (`DeviceEventDto.type`) in the reader's language — "มิเตอร์เปลี่ยนสถานะ" for
 * `meter_status_changed`. A type the app does not know yet reads "เหตุการณ์อื่นจากอุปกรณ์" — never its code on
 * screen; the code stays in `data-event-type` and, where support staff need it (`showCode`, admin), in the
 * element's tooltip. Works in server and client components.
 */
export function DeviceEventName({ type, showCode = false }: { type: string; showCode?: boolean }) {
  const t = useTranslations();
  const key = deviceEventLabelKey(type);
  return (
    <span className="font-medium" data-event-type={type} title={showCode ? type : undefined}>
      {key ? t(key) : t("glossary.deviceEventOther")}
    </span>
  );
}
