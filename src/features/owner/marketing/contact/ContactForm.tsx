"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";

import { submitContact, type ContactState } from "./actions";

const ROLES = ["dorm", "landlord", "renter", "partner"] as const;

/** The contact form: a lead for the team, sent by a Server Action; works without JS (progressive enhancement). */
export function ContactForm({ privacyHref }: { privacyHref: string }) {
  const t = useTranslations("owner.marketing.contact");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });
  const invalid = (field: string) =>
    state.status === "invalid" && state.fields.includes(field)
      ? field === "phone"
        ? t("invalidPhone")
        : t("required")
      : undefined;

  if (state.status === "sent") {
    return (
      <p role="status" className="bg-success-subtle text-success-subtle-fg rounded-card p-6 text-lg">
        {t("sent")}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} error={invalid("name")}>
          <Input name="name" autoComplete="name" required />
        </Field>
        <Field label={t("phone")} error={invalid("phone")}>
          <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
        </Field>
        <Field label={t("email")} error={invalid("email")}>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label={t("units")} error={invalid("units")}>
          <Input name="units" inputMode="numeric" />
        </Field>
      </div>
      <Field label={t("role")}>
        <NativeSelect
          name="role"
          defaultValue="dorm"
          options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
        />
      </Field>
      <Field label={t("message")} error={invalid("message")}>
        <Textarea name="message" rows={5} required />
      </Field>
      <div>
        <Checkbox name="consent" value="on" required label={t("consent")} />
        {invalid("consent") ? (
          <Callout tone="danger" className="mt-2">
            {t("required")}
          </Callout>
        ) : null}
        <a href={privacyHref} className="text-muted ms-11 text-sm underline underline-offset-4">
          {t("privacy")}
        </a>
      </div>
      {state.status === "failed" ? <Callout tone="danger">{t("failed")}</Callout> : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
