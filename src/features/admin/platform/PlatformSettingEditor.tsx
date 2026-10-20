"use client";

import { SettingEditor, type SettingValueType } from "@/features/shared/console/SettingEditor";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** `PUT /v1/admin/settings/{key}` (platform value) or `…/tenants/{id}/settings/{key}` (one tenant's value). */
export function PlatformSettingEditor({
  settingKey,
  description,
  valueType,
  value,
  tenantId,
}: {
  settingKey: string;
  description: string;
  valueType: SettingValueType;
  value: unknown;
  tenantId?: string;
}) {
  return (
    <SettingEditor
      settingKey={settingKey}
      description={description}
      valueType={valueType}
      value={value}
      onSave={(input) =>
        tenantId
          ? unwrap(
              browserApi().PUT("/v1/admin/tenants/{tenantId}/settings/{key}", {
                params: { path: { tenantId, key: settingKey } },
                body: input as Schemas["SettingUpdateDto"],
              }),
            )
          : unwrap(
              browserApi().PUT("/v1/admin/settings/{key}", {
                params: { path: { key: settingKey } },
                body: input as Schemas["SettingUpdateDto"],
              }),
            )
      }
    />
  );
}
