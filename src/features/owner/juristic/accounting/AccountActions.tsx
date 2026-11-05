"use client";

import { useTranslations } from "next-intl";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";

type Bank = { id: string; label: string };
const TYPES: readonly Schemas["JuristicAccountType"][] = ["asset", "liability", "equity", "income", "expense"];

/** Adds an account to the chart (code unique, type fixed once the account is used). */
export function NewAccountButton({ banks }: { banks: Bank[] }) {
  const t = useTranslations("owner.accounting.accounts");
  const types = useTranslations("owner.accounting.accountType");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant="primary"
      testId="account-new"
      title={t("addTitle")}
      description={t("addBody")}
      submitLabel={t("addSubmit")}
      successMessage={t("added")}
      onSubmit={(data) => {
        const bankAccountId = text(data, "bankAccountId");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/accounts", {
            body: {
              code: text(data, "code") ?? "",
              type: (text(data, "type") ?? "expense") as Schemas["JuristicAccountType"],
              nameTh: text(data, "nameTh") ?? "",
              nameEn: text(data, "nameEn") ?? "",
              ...(bankAccountId ? { bankAccountId } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <Field label={t("code")} hint={t("codeHint")} required error={errors.code}>
              <Input name="code" maxLength={20} className="font-mono" data-testid="account-code" />
            </Field>
            <Field label={t("type")} hint={t("typeHint")} required error={errors.type}>
              <NativeSelect
                name="type"
                defaultValue="expense"
                options={TYPES.map((value) => ({ value, label: types(value) }))}
                data-testid="account-type"
              />
            </Field>
          </div>
          <Field label={t("nameTh")} required error={errors.nameTh}>
            <Input name="nameTh" maxLength={200} data-testid="account-name-th" />
          </Field>
          <Field label={t("nameEn")} required error={errors.nameEn}>
            <Input name="nameEn" maxLength={200} data-testid="account-name-en" />
          </Field>
          {banks.length ? (
            <Field label={t("bank")} hint={t("bankHint")} error={errors.bankAccountId}>
              <NativeSelect
                name="bankAccountId"
                placeholder={t("noBank")}
                options={banks.map((bank) => ({ value: bank.id, label: bank.label }))}
              />
            </Field>
          ) : null}
        </>
      )}
    </FormDialog>
  );
}

/** Rename, link a bank account, deactivate (not system accounts) — one "⋯" menu per row. */
export function AccountRowActions({ account, banks }: { account: Schemas["AccountDto"]; banks: Bank[] }) {
  const t = useTranslations("owner.accounting.accounts");
  const patch = (body: Schemas["AccountUpdateDto"]) =>
    unwrap(
      browserApi().PATCH("/v1/owner/juristic/accounts/{accountId}", {
        params: { path: { accountId: account.id } },
        body: { ...body, version: account.version },
      }),
    );
  return (
    <ActionMenu label={t("actionsFor", { code: account.code })} testId="account-actions">
      <FormDialog
        label={t("edit")}
        icon={IconEdit}
        testId="account-edit"
        title={t("editTitle", { code: account.code })}
        submitLabel={t("save")}
        successMessage={t("saved")}
        onSubmit={(data) => {
          const bank = text(data, "bankAccountId");
          return patch({
            nameTh: text(data, "nameTh") ?? account.nameTh,
            nameEn: text(data, "nameEn") ?? account.nameEn,
            ...(account.type === "asset" ? { bankAccountId: bank ?? null } : {}),
          });
        }}
      >
        {(errors) => (
          <>
            <Field label={t("nameTh")} required error={errors.nameTh}>
              <Input name="nameTh" defaultValue={account.nameTh} maxLength={200} />
            </Field>
            <Field label={t("nameEn")} required error={errors.nameEn}>
              <Input name="nameEn" defaultValue={account.nameEn} maxLength={200} />
            </Field>
            {account.type === "asset" && account.role !== "fund_bank" && banks.length ? (
              <Field label={t("bank")} hint={t("bankHint")}>
                <NativeSelect
                  name="bankAccountId"
                  defaultValue={account.bankAccountId ?? ""}
                  placeholder={t("noBank")}
                  options={banks.map((bank) => ({ value: bank.id, label: bank.label }))}
                />
              </Field>
            ) : null}
            <p className="text-muted m-0 text-sm">{t("codeFixed")}</p>
          </>
        )}
      </FormDialog>
      {account.isSystem ? null : (
        <ConfirmAction
          label={account.isActive ? t("deactivate") : t("activate")}
          variant="secondary"
          tone={account.isActive ? "destructive" : "primary"}
          testId="account-toggle"
          title={
            account.isActive ? t("deactivateTitle", { code: account.code }) : t("activateTitle", { code: account.code })
          }
          description={account.isActive ? t("deactivateBody") : t("activateBody")}
          confirmLabel={account.isActive ? t("deactivate") : t("activate")}
          successMessage={t("saved")}
          onConfirm={() => patch({ isActive: !account.isActive })}
        />
      )}
    </ActionMenu>
  );
}
