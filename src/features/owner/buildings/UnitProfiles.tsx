"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconTag } from "@/ui/icons/glyphs/tag";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";

const LINE_KINDS: Schemas["LeaseLineKind"][] = [
  "internet",
  "parking",
  "cleaning",
  "furniture",
  "common_fee",
  "water_minimum",
  "other_fixed",
];

function readLines(data: FormData): Schemas["LeaseLineDefaultDto"][] {
  const lines: Schemas["LeaseLineDefaultDto"][] = [];
  for (let index = 0; data.has(`lines.${index}.kind`); index += 1) {
    const description = text(data, `lines.${index}.description`);
    const amount = text(data, `lines.${index}.amount`);
    if (!description && !amount) continue;
    lines.push({
      kind: (text(data, `lines.${index}.kind`) ?? "other_fixed") as Schemas["LeaseLineKind"],
      description: description ?? "",
      amount: amount ?? "",
    });
  }
  return lines;
}

function ProfileFields({ profile, errors }: { profile?: Schemas["UnitProfileDto"]; errors: Record<string, string> }) {
  const t = useTranslations("owner.buildings.profiles");
  const kinds = useTranslations("owner.common.lineKind");
  const [rows, setRows] = useState<Schemas["LeaseLineDefaultDto"][]>(
    profile?.defaultLeaseLines.length ? profile.defaultLeaseLines : [],
  );
  return (
    <>
      <Field label={t("name")} required error={errors.name}>
        <Input name="name" required defaultValue={profile?.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("rent")} required hint={t("moneyHint")} error={errors.defaultRent}>
          <Input name="defaultRent" required inputMode="decimal" defaultValue={profile?.defaultRent} />
        </Field>
        <Field label={t("area")} error={errors.areaSqm}>
          <Input name="areaSqm" inputMode="decimal" defaultValue={profile?.areaSqm ?? ""} />
        </Field>
        <Field label={t("deposit")} hint={t("monthsHint")} error={errors.defaultDepositMonths}>
          <Input name="defaultDepositMonths" inputMode="decimal" defaultValue={profile?.defaultDepositMonths ?? "1"} />
        </Field>
        <Field label={t("advance")} hint={t("monthsHint")} error={errors.defaultAdvanceRentMonths}>
          <Input
            name="defaultAdvanceRentMonths"
            inputMode="decimal"
            defaultValue={profile?.defaultAdvanceRentMonths ?? "1"}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">{t("lines")}</legend>
        <p className="text-muted text-sm">{t("linesHint")}</p>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid items-end gap-2 sm:grid-cols-[10rem_1fr_8rem_auto]"
            data-testid="profile-line"
          >
            <Field label={t("lineKind")} labelHidden={index > 0}>
              <NativeSelect
                name={`lines.${index}.kind`}
                defaultValue={row.kind}
                options={LINE_KINDS.map((kind) => ({ value: kind, label: kinds(kind) }))}
              />
            </Field>
            <Field
              label={t("lineDescription")}
              labelHidden={index > 0}
              error={errors[`defaultLeaseLines.${index}.description`]}
            >
              <Input name={`lines.${index}.description`} defaultValue={row.description} />
            </Field>
            <Field label={t("lineAmount")} labelHidden={index > 0} error={errors[`defaultLeaseLines.${index}.amount`]}>
              <Input name={`lines.${index}.amount`} inputMode="decimal" defaultValue={row.amount} />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              iconStart={IconDelete}
              onClick={() => setRows((current) => current.filter((_, candidate) => candidate !== index))}
            >
              {t("removeLine")}
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          iconStart={IconAdd}
          className="self-start"
          onClick={() => setRows((current) => [...current, { kind: "internet", description: "", amount: "" }])}
          data-testid="profile-add-line"
        >
          {t("addLine")}
        </Button>
      </fieldset>
    </>
  );
}

/**
 * Unit types of a building (F2 2.1 "unit type editor", `unit_profile`): the default rent, deposit and
 * advance-rent months and the lease lines a new lease of such a unit starts from. Utilities are never
 * fixed lines (D-022) — they come from meters and rate plans.
 */
export function UnitProfiles({ buildingId, profiles }: { buildingId: string; profiles: Schemas["UnitProfileDto"][] }) {
  const t = useTranslations("owner.buildings.profiles");
  const kinds = useTranslations("owner.common.lineKind");
  const locale = useLocale() as Locale;

  const body = (data: FormData) => ({
    name: text(data, "name") ?? "",
    defaultRent: text(data, "defaultRent") ?? "",
    areaSqm: text(data, "areaSqm") ?? null,
    defaultDepositMonths: text(data, "defaultDepositMonths"),
    defaultAdvanceRentMonths: text(data, "defaultAdvanceRentMonths"),
    defaultLeaseLines: readLines(data),
  });

  return (
    <div className="flex flex-col gap-4" data-testid="unit-profiles">
      <div className="flex justify-end">
        <FormDialog
          label={t("new")}
          icon={IconAdd}
          variant="primary"
          size_="lg"
          testId="new-profile"
          title={t("newTitle")}
          submitLabel={t("create")}
          successMessage={t("created")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/buildings/{buildingId}/unit-profiles", {
                params: { path: { buildingId } },
                body: body(data),
              }),
            )
          }
        >
          {(errors) => <ProfileFields errors={errors} />}
        </FormDialog>
      </div>
      {profiles.length === 0 ? (
        <Card>
          <EmptyState icon={IconTag} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Card className="flex flex-col gap-3" data-testid="profile-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{profile.name}</h2>
                    <p className="text-muted text-sm">
                      {t("summary", {
                        rent: formatTHB(profile.defaultRent, locale),
                        deposit: formatDecimal(profile.defaultDepositMonths, locale),
                        advance: formatDecimal(profile.defaultAdvanceRentMonths, locale),
                      })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <FormDialog
                      label={t("edit")}
                      icon={IconEdit}
                      variant="ghost"
                      size="sm"
                      size_="lg"
                      testId="edit-profile"
                      title={t("editTitle", { name: profile.name })}
                      submitLabel={t("save")}
                      successMessage={t("saved")}
                      onSubmit={async (data) => {
                        // The list carries no ETag: read the profile with its ETag, then send it as If-Match
                        // (a change someone made meanwhile answers 412 instead of being overwritten).
                        const { etag } = await unwrapWithETag(
                          browserApi().GET("/v1/owner/unit-profiles/{unitProfileId}", {
                            params: { path: { unitProfileId: profile.id } },
                          }),
                        );
                        return unwrap(
                          browserApi().PATCH("/v1/owner/unit-profiles/{unitProfileId}", {
                            params: { path: { unitProfileId: profile.id }, header: { "If-Match": etag ?? "*" } },
                            body: body(data),
                          }),
                        );
                      }}
                    >
                      {(errors) => <ProfileFields profile={profile} errors={errors} />}
                    </FormDialog>
                    <ConfirmAction
                      label={t("remove")}
                      icon={IconDelete}
                      variant="ghost"
                      size="sm"
                      tone="destructive"
                      title={t("removeTitle", { name: profile.name })}
                      description={t("removeBody")}
                      confirmLabel={t("remove")}
                      successMessage={t("removed")}
                      onConfirm={() =>
                        unwrap(
                          browserApi().DELETE("/v1/owner/unit-profiles/{unitProfileId}", {
                            params: { path: { unitProfileId: profile.id } },
                          }),
                        )
                      }
                    />
                  </div>
                </div>
                {profile.defaultLeaseLines.length ? (
                  <ul className="text-sm">
                    {profile.defaultLeaseLines.map((line, index) => (
                      <li key={index} className="flex justify-between gap-2">
                        <span>
                          {kinds(line.kind)} · {line.description}
                        </span>
                        <span className="tabular-nums">{formatTHB(line.amount, locale)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-sm">{t("noLines")}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
