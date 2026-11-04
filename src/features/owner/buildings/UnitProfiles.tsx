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
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconTag } from "@/ui/icons/glyphs/tag";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ownerPath } from "../shared/links";

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

function profileBody(data: FormData) {
  return {
    name: text(data, "name") ?? "",
    defaultRent: text(data, "defaultRent") ?? "",
    areaSqm: text(data, "areaSqm") ?? null,
    defaultDepositMonths: text(data, "defaultDepositMonths"),
    defaultAdvanceRentMonths: text(data, "defaultAdvanceRentMonths"),
    defaultLeaseLines: readLines(data),
  };
}

/** "เพิ่มประเภทห้อง" — the page head's one filled action. */
export function NewProfileButton({ buildingId }: { buildingId: string }) {
  const t = useTranslations("owner.buildings.profiles");
  return (
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
            body: profileBody(data),
          }),
        )
      }
    >
      {(errors) => <ProfileFields errors={errors} />}
    </FormDialog>
  );
}

/** A row's "⋯": edit and remove (destructive, last), each opening its dialog. */
function ProfileMenu({ profile }: { profile: Schemas["UnitProfileDto"] }) {
  const t = useTranslations("owner.buildings.profiles");
  return (
    <ActionMenu label={t("rowMenu", { name: profile.name })} testId="profile-menu">
      <FormDialog
        label={t("edit")}
        icon={IconEdit}
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
              body: profileBody(data),
            }),
          );
        }}
      >
        {(errors) => <ProfileFields profile={profile} errors={errors} />}
      </FormDialog>
      <ConfirmAction
        label={t("remove")}
        icon={IconDelete}
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
    </ActionMenu>
  );
}

/**
 * Unit types of a building (F2 2.1 "unit type editor", `unit_profile`; G3 revision: the list pattern): one row per
 * type — default rent, deposit and advance months, the fixed lease lines — with edit and remove in one "⋯" menu; the
 * page head carries "add". Utilities are never fixed lines (D-022) — they come from meters and rate plans.
 */
export function UnitProfiles({ buildingId, profiles }: { buildingId: string; profiles: Schemas["UnitProfileDto"][] }) {
  const t = useTranslations("owner.buildings.profiles");
  const kinds = useTranslations("owner.common.lineKind");
  const locale = useLocale() as Locale;

  if (profiles.length === 0)
    return (
      <div data-testid="unit-profiles">
        <Card>
          <EmptyState
            icon={IconTag}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, `/buildings/${buildingId}`)}>{t("empty.action")}</a>
              </Button>
            }
          />
        </Card>
      </div>
    );

  return (
    <div data-testid="unit-profiles">
      <SimpleTable
        caption={t("caption")}
        stackOnPhones
        minWidth="52rem"
        columns={[
          { key: "name", header: t("col.name"), phone: "title" },
          { key: "rent", header: t("col.rent"), align: "end", phone: "figure" },
          { key: "deposit", header: t("col.deposit"), align: "end", phone: "meta" },
          { key: "advance", header: t("col.advance"), align: "end", phone: "meta" },
          { key: "lines", header: t("col.lines"), phone: "meta" },
          { key: "menu", header: <span className="sr-only">{t("col.name")}</span>, align: "end", phone: "status" },
        ]}
        rows={profiles.map((profile) => ({
          key: profile.id,
          testId: "profile-card",
          cells: {
            name: (
              <span className="flex flex-col">
                <span className="font-medium">{profile.name}</span>
                {profile.areaSqm ? (
                  <span className="text-muted text-sm">
                    {t("areaValue", { area: formatDecimal(profile.areaSqm, locale) })}
                  </span>
                ) : null}
              </span>
            ),
            rent: <span className="font-medium tabular-nums">{formatTHB(profile.defaultRent, locale)}</span>,
            deposit: t("monthsValue", { months: formatDecimal(profile.defaultDepositMonths, locale) }),
            advance: t("monthsValue", { months: formatDecimal(profile.defaultAdvanceRentMonths, locale) }),
            lines: profile.defaultLeaseLines.length ? (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm">
                {profile.defaultLeaseLines.map((line, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span className="text-muted">
                      {kinds(line.kind)} · {line.description}
                    </span>
                    <span className="tabular-nums">{formatTHB(line.amount, locale)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted text-sm">{t("noLines")}</span>
            ),
            menu: <ProfileMenu profile={profile} />,
          },
        }))}
      />
    </div>
  );
}
