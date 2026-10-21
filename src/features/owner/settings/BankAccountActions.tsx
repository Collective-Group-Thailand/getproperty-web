"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { OTPInput } from "@/ui/components/OTPInput";
import { LazyDialog } from "@/ui/components/overlays";
import { Stepper } from "@/ui/components/Stepper";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconShield } from "@/ui/icons/glyphs/shield";

/**
 * Thai banks by their Bank of Thailand code — reference data (the API stores the code and the Thai
 * name the owner picked; it validates the account with the provider, never this list).
 */
export const THAI_BANKS: { code: string; nameTh: string }[] = [
  { code: "002", nameTh: "ธนาคารกรุงเทพ" },
  { code: "004", nameTh: "ธนาคารกสิกรไทย" },
  { code: "006", nameTh: "ธนาคารกรุงไทย" },
  { code: "011", nameTh: "ธนาคารทหารไทยธนชาต" },
  { code: "014", nameTh: "ธนาคารไทยพาณิชย์" },
  { code: "022", nameTh: "ธนาคารซีไอเอ็มบี ไทย" },
  { code: "024", nameTh: "ธนาคารยูโอบี" },
  { code: "025", nameTh: "ธนาคารกรุงศรีอยุธยา" },
  { code: "030", nameTh: "ธนาคารออมสิน" },
  { code: "033", nameTh: "ธนาคารอาคารสงเคราะห์" },
  { code: "034", nameTh: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
  { code: "067", nameTh: "ธนาคารทิสโก้" },
  { code: "069", nameTh: "ธนาคารเกียรตินาคินภัทร" },
  { code: "073", nameTh: "ธนาคารแลนด์ แอนด์ เฮ้าส์" },
];
const PROVIDERS: Schemas["PaymentProvider"][] = ["kbank", "scb", "opn", "none"];

/** The OTP step of a bank account change (D-042): the code sent to the owner's phone confirms it. */
function OtpStep({
  account,
  challenge,
  onChallenge,
  onDone,
}: {
  account: Schemas["BankAccountDto"];
  challenge: Schemas["OtpChallengeDto"] | null;
  onChallenge: (challenge: Schemas["OtpChallengeDto"]) => void;
  onDone: () => void;
}) {
  const t = useTranslations("owner.settings.bank");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState("");
  const confirm = useApiAction({ refresh: false });
  const resend = useApiAction({ refresh: false });
  const submit = (value: string) => {
    if (!challenge) return;
    void confirm.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/bank-accounts/{bankAccountId}/actions/confirm", {
            params: { path: { bankAccountId: account.id } },
            body: { challengeId: challenge.challengeId, code: value },
          }),
        ),
      () => {
        toast.success(t("confirmed"));
        onDone();
      },
    );
  };
  return (
    <div className="flex flex-col gap-4" data-testid="bank-otp">
      <p className="text-sm">{t("otpBody", { bank: account.bankNameTh, account: account.accountNoMasked })}</p>
      {challenge ? (
        <Field
          label={t("otpCode")}
          hint={t("otpExpires", { date: formatDateTime(challenge.expiresAt, locale) })}
          required
        >
          <OTPInput
            value={code}
            onChange={setCode}
            onComplete={submit}
            digitLabel={(index) => t("otpDigit", { index: index + 1 })}
            autoFocus
            disabled={confirm.busy}
          />
        </Field>
      ) : (
        <p className="text-muted text-sm">{t("otpNeedsResend")}</p>
      )}
      <ProblemNotice error={confirm.error ?? resend.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => submit(code)}
          disabled={!challenge || code.length < 6}
          loading={confirm.busy}
          data-testid="bank-otp-confirm"
        >
          {t("confirm")}
        </Button>
        <Button
          variant="secondary"
          loading={resend.busy}
          data-testid="bank-otp-resend"
          onClick={() =>
            void resend.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/owner/bank-accounts/{bankAccountId}/actions/resend-otp", {
                    params: { path: { bankAccountId: account.id } },
                  }),
                ),
              (next) => {
                onChallenge(next as Schemas["OtpChallengeDto"]);
                setCode("");
                toast.success(t("resent"));
              },
            )
          }
        >
          {t("resend")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Add (or change) a receiving bank account (D-042): the account details → `POST /v1/owner/bank-accounts`
 * (Idempotency-Key) → the SMS OTP the API sends to the owner → confirm. Until it is confirmed the
 * account stays `pending_otp` and receives nothing.
 */
export function AddBankAccount({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.settings.bank");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Schemas["BankAccountRequestedDto"] | null>(null);
  const action = useApiAction<Schemas["BankAccountRequestedDto"]>({ refresh: false });
  const idempotency = useIdempotencyKey();
  const close = () => {
    setOpen(false);
    setPending(null);
    idempotency.renewUnless(action.unansweredAttempt()); // review L2
    router.refresh();
  };
  return (
    <>
      <Button
        iconStart={IconAdd}
        onClick={() => {
          action.reset();
          setOpen(true);
        }}
        data-testid="add-bank-account"
      >
        {t("add")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={t("addTitle")}
        description={t("addHint")}
        closeLabel={common("close")}
        size="md"
        footer={
          pending ? undefined : (
            <>
              <Button variant="secondary" onClick={close} disabled={action.busy}>
                {common("cancel")}
              </Button>
              <Button type="submit" form="bank-account-form" loading={action.busy} data-testid="bank-submit">
                {t("sendOtp")}
              </Button>
            </>
          )
        }
      >
        <Stepper
          label={t("steps")}
          progressText={t("stepOf", { step: pending ? 2 : 1, total: 2 })}
          current={pending ? 1 : 0}
          steps={[
            { id: "details", label: t("stepDetails") },
            { id: "otp", label: t("stepOtp") },
          ]}
        />
        {pending ? (
          <OtpStep
            account={pending.account}
            challenge={pending.otp}
            onChallenge={(otp) => setPending({ ...pending, otp })}
            onDone={close}
          />
        ) : (
          <form
            id="bank-account-form"
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const bank = THAI_BANKS.find((candidate) => candidate.code === text(data, "bankCode"));
              const chosen = buildings
                .filter((building) => data.get(`building:${building.id}`) === "on")
                .map((building) => building.id);
              void action.run(
                () =>
                  unwrap(
                    browserApi().POST("/v1/owner/bank-accounts", {
                      params: { header: { "Idempotency-Key": idempotency.key } },
                      body: {
                        bankCode: bank?.code ?? "",
                        bankNameTh: bank?.nameTh ?? "",
                        accountNo: (text(data, "accountNo") ?? "").replace(/\D/g, ""),
                        accountName: text(data, "accountName") ?? "",
                        branch: text(data, "branch"),
                        isDefault: data.get("isDefault") === "on",
                        buildingIds: chosen.length ? chosen : undefined,
                        paymentProvider: (text(data, "paymentProvider") ?? "none") as Schemas["PaymentProvider"],
                        providerMerchantRef: text(data, "providerMerchantRef"),
                      },
                    }),
                  ),
                (requested) => setPending(requested),
              );
            }}
          >
            <Field label={t("bank")} required>
              <NativeSelect
                name="bankCode"
                required
                options={THAI_BANKS.map((bank) => ({ value: bank.code, label: bank.nameTh }))}
                data-testid="bank-code"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("accountNo")} required>
                <Input
                  name="accountNo"
                  required
                  inputMode="numeric"
                  pattern="[\d\- ]{10,15}"
                  autoComplete="off"
                  data-testid="bank-account-no"
                />
              </Field>
              <Field label={t("branch")}>
                <Input name="branch" />
              </Field>
            </div>
            <Field label={t("accountName")} hint={t("accountNameHint")} required>
              <Input name="accountName" required data-testid="bank-account-name" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("provider")} hint={t("providerHint")}>
                <NativeSelect
                  name="paymentProvider"
                  defaultValue="none"
                  options={PROVIDERS.map((value) => ({ value, label: t(`providerName.${value}`) }))}
                />
              </Field>
              <Field label={t("merchantRef")} hint={t("merchantRefHint")}>
                <Input name="providerMerchantRef" autoComplete="off" />
              </Field>
            </div>
            {buildings.length > 1 ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-sm font-medium">{t("buildings")}</legend>
                <p className="text-muted text-sm">{t("buildingsHint")}</p>
                {buildings.map((building) => (
                  <Checkbox key={building.id} name={`building:${building.id}`} label={building.name} />
                ))}
              </fieldset>
            ) : null}
            <Checkbox name="isDefault" label={t("isDefault")} defaultChecked />
            <ProblemNotice error={action.error} />
          </form>
        )}
      </LazyDialog>
    </>
  );
}

/** A pending account after a reload: a new OTP (`resend-otp`) and the confirm step. */
export function ConfirmPendingAccount({ account }: { account: Schemas["BankAccountDto"] }) {
  const t = useTranslations("owner.settings.bank");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [challenge, setChallenge] = useState<Schemas["OtpChallengeDto"] | null>(null);
  return (
    <>
      <Button size="sm" iconStart={IconShield} onClick={() => setOpen(true)} data-testid={`confirm-${account.id}`}>
        {t("enterOtp")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle", { account: account.accountNoMasked })}
        closeLabel={common("close")}
      >
        <OtpStep
          account={account}
          challenge={challenge}
          onChallenge={setChallenge}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </LazyDialog>
    </>
  );
}

/** `POST …/actions/remove` — typed: the masked account number restated. */
export function RemoveBankAccount({ account }: { account: Schemas["BankAccountDto"] }) {
  const t = useTranslations("owner.settings.bank");
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconRemove}
      size="sm"
      variant="destructive"
      tone="destructive"
      testId={`remove-${account.id}`}
      title={t("removeTitle", { account: account.accountNoMasked })}
      description={t("removeBody", { bank: account.bankNameTh })}
      confirmLabel={t("remove")}
      phrase={account.accountNoMasked}
      successMessage={t("removed")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/bank-accounts/{bankAccountId}/actions/remove", {
            params: { path: { bankAccountId: account.id } },
          }),
        )
      }
    />
  );
}
