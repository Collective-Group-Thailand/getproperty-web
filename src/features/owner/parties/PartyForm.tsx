"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconAdd } from "@/ui/icons/glyphs/add";

import { FormDialog, text } from "../shared/FormDialog";

/** The fields of a new party; shared by the party directory and the lease wizard's "new resident". */
export function PartyFields({ errors }: { errors: Record<string, string> }) {
  const t = useTranslations("owner.parties.form");
  const [type, setType] = useState<Schemas["PartyType"]>("person");
  return (
    <>
      <input type="hidden" name="type" value={type} />
      <SegmentedControl
        label={t("type")}
        value={type}
        onValueChange={(value) => setType(value as Schemas["PartyType"])}
        options={[
          { value: "person", label: t("person") },
          { value: "company", label: t("company") },
        ]}
      />
      {type === "person" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("firstName")} required error={errors.firstName}>
            <Input name="firstName" required autoComplete="off" />
          </Field>
          <Field label={t("lastName")} required error={errors.lastName}>
            <Input name="lastName" required autoComplete="off" />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("companyName")} required error={errors.companyName ?? errors.displayName}>
            <Input name="companyName" required autoComplete="off" />
          </Field>
          <Field label={t("taxId")} hint={t("taxIdHint")} error={errors.taxId}>
            <Input name="taxId" inputMode="numeric" maxLength={13} className="font-mono" />
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("phone")} hint={t("phoneHint")} error={errors.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="off" />
        </Field>
        <Field label={t("email")} error={errors.email}>
          <Input name="email" type="email" autoComplete="off" />
        </Field>
      </div>
      {type === "person" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("idType")} error={errors.idDocumentType}>
            <NativeSelect
              name="idDocumentType"
              options={[
                { value: "thai_national_id", label: t("thaiId") },
                { value: "passport", label: t("passport") },
                { value: "other", label: t("otherId") },
              ]}
            />
          </Field>
          <Field label={t("idNumber")} hint={t("idNumberHint")} error={errors.idNumber}>
            <Input name="idNumber" inputMode="numeric" autoComplete="off" className="font-mono" />
          </Field>
        </div>
      ) : null}
      <Field label={t("language")} hint={t("languageHint")}>
        <NativeSelect
          name="language"
          options={[
            { value: "th", label: t("th") },
            { value: "en", label: t("en") },
          ]}
        />
      </Field>
    </>
  );
}

export function partyBody(data: FormData): Schemas["PartyCreateDto"] {
  const type = (text(data, "type") ?? "person") as Schemas["PartyType"];
  const first = text(data, "firstName");
  const last = text(data, "lastName");
  const company = text(data, "companyName");
  return {
    type,
    displayName: type === "company" ? (company ?? "") : [first, last].filter(Boolean).join(" "),
    firstName: type === "person" ? (first ?? null) : null,
    lastName: type === "person" ? (last ?? null) : null,
    companyName: type === "company" ? (company ?? null) : null,
    taxId: type === "company" ? (text(data, "taxId") ?? null) : null,
    phone: text(data, "phone") ?? null,
    email: text(data, "email") ?? null,
    idDocumentType: type === "person" ? ((text(data, "idDocumentType") as Schemas["IdDocumentType"]) ?? null) : null,
    idNumber: type === "person" ? (text(data, "idNumber") ?? null) : null,
    language: (text(data, "language") ?? "th") as Schemas["ResidentLanguage"],
  };
}

/** `POST /v1/owner/parties` — a resident or another party of the tenant (D-151, D-148: the ID number is sealed). */
export function NewPartyButton({
  defaultOpen,
  onCreated,
  variant = "primary",
}: {
  defaultOpen?: boolean;
  onCreated?: (party: Schemas["PartyDto"]) => void;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("owner.parties");
  const router = useRouter();
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant={variant}
      testId="new-party"
      title={t("newTitle")}
      description={t("newBody")}
      submitLabel={t("create")}
      successMessage={t("created")}
      size_="lg"
      defaultOpen={defaultOpen}
      onSubmit={(data) => unwrap(browserApi().POST("/v1/owner/parties", { body: partyBody(data) }))}
      onDone={(result) => {
        const party = result as Schemas["PartyDto"];
        if (onCreated) onCreated(party);
        else router.push(`/parties/${party.id}`);
      }}
    >
      {(errors) => <PartyFields errors={errors} />}
    </FormDialog>
  );
}
