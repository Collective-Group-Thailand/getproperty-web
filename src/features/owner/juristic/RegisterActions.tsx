"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { KIND_TRAITS, vocabularyKeys, type PropertyKind } from "@/domain/juristic/vocabulary";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Combobox } from "@/ui/components/Combobox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconPrinter } from "@/ui/icons/glyphs/printer";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { uploadOwnerFile } from "../shared/upload";
import { checkShares, formatShare, parseShare, shareString, WHOLE } from "./shares";

export interface PartyOption {
  id: string;
  name: string;
  type: Schemas["PartyType"];
}

type Register = Schemas["RegisterUnitDetailDto"];

/**
 * Chooses a person or company: someone already among the tenant's people, or a new one created with the change
 * (`partyId` / `party` of the register's requests). Renders hidden inputs `${name}.partyId` or the new party's fields,
 * so the surrounding form reads it from its data (`readParty`).
 */
export function PartyChooser({
  name,
  parties,
  errors,
  legend,
  exclude = [],
}: {
  name: string;
  parties: PartyOption[];
  errors: Record<string, string>;
  legend: string;
  exclude?: string[];
}) {
  const t = useTranslations("owner.juristic.party");
  const options = parties.filter((party) => !exclude.includes(party.id));
  const [source, setSource] = useState<"existing" | "new">(options.length ? "existing" : "new");
  const [partyId, setPartyId] = useState<string | null>(null);
  return (
    <fieldset className="flex flex-col gap-3" data-testid={`${name}-chooser`}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.length ? (
        <SegmentedControl
          label={legend}
          value={source}
          onValueChange={(value) => setSource(value as "existing" | "new")}
          options={[
            { value: "existing", label: t("existing") },
            { value: "new", label: t("new") },
          ]}
        />
      ) : null}
      <input type="hidden" name={`${name}.source`} value={source} />
      {source === "existing" ? (
        <Field label={t("pick")} required error={errors[`${name}.partyId`] ?? errors.partyId}>
          <Combobox
            options={options.map((party) => ({
              value: party.id,
              label: party.name,
              description: t(`type.${party.type}`),
            }))}
            value={partyId}
            onChange={setPartyId}
            placeholder={t("searchPlaceholder")}
            emptyLabel={t("noMatch")}
            listLabel={t("pick")}
          />
          <input type="hidden" name={`${name}.partyId`} value={partyId ?? ""} />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("name")}
            required
            error={errors[`${name}.displayName`] ?? errors[`${name}.party.displayName`]}
          >
            <Input name={`${name}.displayName`} required autoComplete="off" data-testid={`${name}-name`} />
          </Field>
          <Field label={t("typeLabel")}>
            <NativeSelect
              name={`${name}.type`}
              options={(["person", "company"] as const).map((value) => ({ value, label: t(`type.${value}`) }))}
            />
          </Field>
          <Field
            label={t("phone")}
            hint={t("phoneHint")}
            error={errors[`${name}.phone`] ?? errors[`${name}.party.phone`]}
          >
            <Input name={`${name}.phone`} type="tel" inputMode="tel" autoComplete="off" />
          </Field>
          <Field label={t("email")} error={errors[`${name}.email`] ?? errors[`${name}.party.email`]}>
            <Input name={`${name}.email`} type="email" autoComplete="off" />
          </Field>
        </div>
      )}
    </fieldset>
  );
}

/** What `PartyChooser` named: an existing party by id, or a new party; a field error when nothing was chosen. */
export function readParty(
  data: FormData,
  name: string,
  messages: { pick: string; name: string },
): { partyId: string } | { party: Schemas["NewPartyDto"] } {
  if (text(data, `${name}.source`) === "existing") {
    const partyId = text(data, `${name}.partyId`);
    if (!partyId) invalidField(`${name}.partyId`, messages.pick);
    return { partyId };
  }
  const displayName = text(data, `${name}.displayName`);
  if (!displayName) invalidField(`${name}.displayName`, messages.name);
  const phone = text(data, `${name}.phone`);
  const email = text(data, `${name}.email`);
  return {
    party: {
      type: (text(data, `${name}.type`) ?? "person") as Schemas["PartyType"],
      displayName,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    },
  };
}

/** A plot of a housing estate (`POST /v1/owner/units`, type `plot`, D-302): house number, plot number, land in ตร.วา. */
export function NewPlotButton({
  buildingId,
  groupName,
  kind,
}: {
  buildingId: string;
  groupName: string;
  kind: PropertyKind;
}) {
  const t = useTranslations("owner.juristic");
  const words = vocabularyKeys(kind);
  return (
    <FormDialog
      label={t("plot.new", { unit: t(words.unit) })}
      icon={IconAdd}
      variant="primary"
      testId="plot-new"
      title={t("plot.newTitle", { group: groupName })}
      description={t("plot.newHint")}
      submitLabel={t("plot.create")}
      successMessage={t("plot.created")}
      onSubmit={(data) => {
        const land = text(data, "landAreaSqwa");
        if (land && !/^\d{1,9}(\.\d{1,6})?$/.test(land)) invalidField("landAreaSqwa", t("plot.landInvalid"));
        return unwrap(
          browserApi().POST("/v1/owner/units", {
            body: {
              buildingId,
              unitNo: text(data, "unitNo") ?? "",
              type: "plot",
              plotNo: text(data, "plotNo") ?? null,
              landAreaSqwa: land ?? null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("plot.unitNo")} hint={t("plot.unitNoHint")} required error={errors.unitNo}>
            <Input name="unitNo" required maxLength={20} className="font-mono" data-testid="plot-unit-no" />
          </Field>
          <Field label={t("plot.plotNo")} error={errors.plotNo}>
            <Input name="plotNo" maxLength={40} className="font-mono" data-testid="plot-no" />
          </Field>
          <Field label={t("plot.land")} hint={t("plot.landHint")} error={errors.landAreaSqwa}>
            <Input name="landAreaSqwa" inputMode="decimal" data-testid="plot-land" />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/** Adds a co-owner (`POST …/owners`): shares are checked here first, then by the API (`register.shares_exceeded`). */
export function AddOwnerButton({ unit, parties }: { unit: Register; parties: PartyOption[] }) {
  const t = useTranslations("owner.juristic");
  const existing = parseShare(unit.sharesTotal) ?? 0;
  const remaining = shareString(Math.max(0, WHOLE - existing));
  return (
    <FormDialog
      label={t("owner.add")}
      icon={IconAdd}
      testId="owner-add"
      title={t("owner.addTitle", { unit: unit.unitNo })}
      description={t("owner.addHint", { remaining })}
      submitLabel={t("owner.addSubmit")}
      successMessage={t("owner.added")}
      size_="lg"
      onSubmit={(data) => {
        const party = readParty(data, "owner", { pick: t("party.pickRequired"), name: t("party.nameRequired") });
        const share = text(data, "sharePct") ?? "";
        const check = checkShares([share], existing);
        if (check.errors[0]) invalidField("sharePct", t(`shares.error.${check.errors[0]}`));
        if (check.state === "over") invalidField("sharePct", t("shares.overWith", { remaining }));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/register/units/{unitId}/owners", {
            params: { path: { unitId: unit.unitId } },
            body: {
              ...party,
              sharePct: share.replace(/%$/, "").trim(),
              ...(text(data, "validFrom") ? { validFrom: text(data, "validFrom") } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <PartyChooser
            name="owner"
            legend={t("owner.who")}
            parties={parties}
            errors={errors}
            exclude={unit.owners.map((owner) => owner.party.id)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("shares.label")}
              hint={t("shares.hintRemaining", { remaining })}
              required
              error={errors.sharePct}
            >
              <Input
                name="sharePct"
                inputMode="decimal"
                required
                defaultValue={remaining === "0" ? "" : remaining}
                data-testid="owner-share"
              />
            </Field>
            <Field label={t("owner.validFrom")} hint={t("owner.validFromHint")} error={errors.validFrom}>
              <DateField name="validFrom" />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/**
 * The unit's register facts (`PATCH …/register/units/{id}` with the version read): plot number and land for a plot,
 * area and ownership ratio for a condominium unit, the title deed number. The words follow the property's kind.
 */
export function EditUnitFactsButton({ unit, kind }: { unit: Register; kind: PropertyKind }) {
  const t = useTranslations("owner.juristic");
  const words = vocabularyKeys(kind);
  const traits = KIND_TRAITS[kind];
  const plot = unit.type === "plot" || traits.layout === "plots";
  const decimal = /^\d{1,9}(\.\d{1,6})?$/;
  return (
    <FormDialog
      label={t("facts.edit")}
      icon={IconEdit}
      testId="unit-facts-edit"
      title={t("facts.editTitle", { unit: unit.unitNo })}
      description={t("facts.editHint")}
      submitLabel={t("facts.save")}
      successMessage={t("facts.saved")}
      onSubmit={(data) => {
        const body: Schemas["RegisterUnitUpdateDto"] = { version: unit.version };
        for (const key of plot ? (["landAreaSqwa"] as const) : (["areaSqm", "ownershipRatio"] as const)) {
          const value = text(data, key);
          if (value && !decimal.test(value)) invalidField(key, t("facts.decimal"));
          body[key] = value ?? null;
        }
        if (plot) body.plotNo = text(data, "plotNo") ?? null;
        body.titleDeedNo = text(data, "titleDeedNo") ?? null;
        return unwrap(
          browserApi().PATCH("/v1/owner/juristic/register/units/{unitId}", {
            params: { path: { unitId: unit.unitId } },
            body,
          }),
        );
      }}
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {plot ? (
            <>
              <Field label={t("plot.plotNo")} error={errors.plotNo}>
                <Input name="plotNo" maxLength={40} defaultValue={unit.plotNo ?? ""} className="font-mono" />
              </Field>
              <Field label={t(words.size)} error={errors.landAreaSqwa}>
                <Input name="landAreaSqwa" inputMode="decimal" defaultValue={unit.landAreaSqwa ?? ""} />
              </Field>
            </>
          ) : (
            <>
              <Field label={t(words.size)} error={errors.areaSqm}>
                <Input name="areaSqm" inputMode="decimal" defaultValue={unit.areaSqm ?? ""} />
              </Field>
              <Field label={t("facts.ratio")} hint={t("facts.ratioHint")} error={errors.ownershipRatio}>
                <Input
                  name="ownershipRatio"
                  inputMode="decimal"
                  defaultValue={unit.ownershipRatio ?? ""}
                  className="font-mono"
                />
              </Field>
            </>
          )}
          <Field label={t("facts.titleDeed")} error={errors.titleDeedNo}>
            <Input name="titleDeedNo" maxLength={60} defaultValue={unit.titleDeedNo ?? ""} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

const CONSENT_TYPES = "application/pdf,image/jpeg,image/png";

/**
 * A bill-to party (D-307): an owner names who receives and pays the unit's invoices — a relative, a company, an
 * agency. The owner's written consent is required: uploaded first (`files/presign` → PUT → complete), then named
 * by its document id. A new bill-to replaces the owner's previous one from its first day.
 */
export function BillToButton({ unit, parties }: { unit: Register; parties: PartyOption[] }) {
  const t = useTranslations("owner.juristic");
  const [consent, setConsent] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("billTo.set")}
      icon={IconAdd}
      testId="bill-to-set"
      title={t("billTo.setTitle", { unit: unit.unitNo })}
      description={t("billTo.setHint")}
      submitLabel={t("billTo.save")}
      successMessage={t("billTo.saved")}
      size_="lg"
      disabled={unit.owners.length === 0}
      onSubmit={async (data) => {
        const ownerPartyId = text(data, "ownerPartyId");
        if (!ownerPartyId) invalidField("ownerPartyId", t("billTo.ownerRequired"));
        const payer = readParty(data, "payer", { pick: t("party.pickRequired"), name: t("party.nameRequired") });
        if (!consent) invalidField("consentDocumentId", t("billTo.consentRequired"));
        const file = await uploadOwnerFile(consent, {
          kind: "other",
          scopeType: "unit",
          scopeId: unit.unitId,
          title: t("billTo.consentTitle", { unit: unit.unitNo }),
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/register/units/{unitId}/bill-to", {
            params: { path: { unitId: unit.unitId } },
            body: {
              ownerPartyId,
              payer,
              kind: (text(data, "kind") ?? "named_party") as Schemas["BillToKind"],
              consentDocumentId: file.id,
              ...(text(data, "consentNote") ? { consentNote: text(data, "consentNote") } : {}),
              ...(text(data, "validFrom") ? { validFrom: text(data, "validFrom") } : {}),
            },
          }),
        );
      }}
      onDone={() => setConsent(null)}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("billTo.owner")} required error={errors.ownerPartyId}>
              <NativeSelect
                name="ownerPartyId"
                required
                defaultValue={unit.owners.length === 1 ? unit.owners[0]!.party.id : undefined}
                placeholder={unit.owners.length === 1 ? undefined : t("billTo.ownerPick")}
                options={unit.owners.map((owner) => ({ value: owner.party.id, label: owner.party.displayName }))}
                data-testid="bill-to-owner"
              />
            </Field>
            <Field label={t("billTo.kind")} error={errors.kind}>
              <NativeSelect
                name="kind"
                options={(["named_party", "agency"] as const).map((value) => ({
                  value,
                  label: t(`billTo.kindName.${value}`),
                }))}
                data-testid="bill-to-kind"
              />
            </Field>
          </div>
          <PartyChooser name="payer" legend={t("billTo.payer")} parties={parties} errors={errors} />
          <Field label={t("billTo.consent")} hint={t("billTo.consentHint")} required error={errors.consentDocumentId}>
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={t("billTo.consentDrop")}
                hint={t("billTo.consentTypes")}
                accept={CONSENT_TYPES}
                maxBytes={10 * 1024 * 1024}
                tooLargeText={t("billTo.consentTooLarge")}
                chooseText={t("billTo.consentChoose")}
                onFiles={(files) => setConsent(files[0] ?? null)}
                data-testid="bill-to-consent"
              />
              {consent ? (
                <p className="text-sm" data-testid="bill-to-consent-name">
                  {t("billTo.consentChosen", { name: consent.name })}
                </p>
              ) : null}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("billTo.validFrom")} hint={t("billTo.validFromHint")} error={errors.validFrom}>
              <DateField name="validFrom" />
            </Field>
            <Field label={t("billTo.note")} error={errors.consentNote}>
              <Textarea name="consentNote" rows={2} maxLength={1000} />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** Ends a bill-to: the owner is billed again from the date given (default today). */
export function EndBillToButton({ unit, billTo }: { unit: Register; billTo: Schemas["BillToDto"] }) {
  const t = useTranslations("owner.juristic");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("billTo.end")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId={`bill-to-end-${billTo.id}`}
      title={t("billTo.endTitle", { name: billTo.billToParty.displayName })}
      description={t("billTo.endBody", { unit: unit.unitNo })}
      confirmLabel={t("billTo.end")}
      successMessage={t("billTo.ended")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/register/units/{unitId}/bill-to/{billToId}/actions/end", {
            params: { path: { unitId: unit.unitId, billToId: billTo.id } },
            body: reason.trim() ? { reason: reason.trim() } : {},
          }),
        )
      }
    >
      <Field label={t("billTo.endReason")}>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
      </Field>
    </ConfirmAction>
  );
}

/**
 * An invite code for a co-owner to link the unit in the LINE Mini App (JR, D-309): the code and its QR are shown once
 * (the API keeps only a hash), so the result opens at once with "print" — the QR goes into a letter for owners
 * who are not on LINE yet.
 */
export function InviteResidentButton({ unit }: { unit: Register }) {
  const t = useTranslations("owner.juristic.invite");
  const locale = useLocale() as Locale;
  const [created, setCreated] = useState<Schemas["UnitResidentInviteCreatedDto"] | null>(null);
  return (
    <>
      <FormDialog
        label={t("create")}
        icon={IconQr}
        testId="invite-create"
        title={t("createTitle", { unit: unit.unitNo })}
        description={t("createHint")}
        submitLabel={t("createSubmit")}
        disabled={unit.owners.length === 0}
        onSubmit={(data, _ack, idempotencyKey) =>
          unwrap(
            browserApi().POST("/v1/owner/units/{unitId}/resident-invites", {
              params: { path: { unitId: unit.unitId }, header: { "Idempotency-Key": idempotencyKey } },
              body: {
                channel: (text(data, "channel") ?? "line_qr") as Schemas["ResidentInviteChannel"],
                ...(text(data, "partyId") ? { partyId: text(data, "partyId") } : {}),
                language: locale,
              },
            }),
          )
        }
        onDone={(result) => setCreated(result as Schemas["UnitResidentInviteCreatedDto"])}
      >
        {(errors) => (
          <>
            <Field label={t("owner")} required error={errors.partyId}>
              <NativeSelect
                name="partyId"
                defaultValue={unit.owners[0]?.party.id}
                options={unit.owners.map((owner) => ({ value: owner.party.id, label: owner.party.displayName }))}
                data-testid="invite-owner"
              />
            </Field>
            <Field label={t("channel")} error={errors.channel}>
              <NativeSelect
                name="channel"
                options={(["line_qr", "sms", "link"] as const).map((value) => ({
                  value,
                  label: t(`channelName.${value}`),
                }))}
                data-testid="invite-channel"
              />
            </Field>
            <p className="text-muted m-0 text-sm">{t("purpose")}</p>
          </>
        )}
      </FormDialog>
      <LazyDialog
        open={created !== null}
        onOpenChange={(open) => !open && setCreated(null)}
        title={t("createdTitle", { unit: unit.unitNo })}
        description={t("createdHint")}
        closeLabel={t("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreated(null)}>
              {t("close")}
            </Button>
            <Button iconStart={IconPrinter} onClick={() => window.print()} data-testid="invite-print">
              {t("print")}
            </Button>
          </>
        }
      >
        {created ? (
          <div className="flex flex-col items-center gap-3 text-center" data-testid="invite-created">
            {/* The API's own QR image (PNG data URL) of the link — nothing is encoded here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={created.qrPngDataUrl}
              alt={t("qrAlt", { unit: created.unitNo })}
              width={200}
              height={200}
              className="rounded-control border-border border bg-white p-2"
            />
            <p className="m-0 font-mono text-lg tracking-wider" data-testid="invite-code">
              {created.code}
            </p>
            <p className="text-muted m-0 text-sm">{t("expires", { date: formatDate(created.expiresAt, locale) })}</p>
          </div>
        ) : null}
      </LazyDialog>
    </>
  );
}

/** "33.3334" → "33.3334%", for the share column. */
export function shareLabel(value: string): string {
  return `${formatShare(value)}%`;
}
