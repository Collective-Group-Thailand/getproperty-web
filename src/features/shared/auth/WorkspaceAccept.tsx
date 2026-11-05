"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { isDisplayName, isOtpCode, isPhone } from "@/domain/forms/auth-rules";
import { acceptWorkspaceInvitation, requestWorkspaceOtp, type ActionProblem } from "@/lib/auth/actions";
import { formatPhone } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { OTPInput } from "@/ui/components/OTPInput";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Stepper } from "@/ui/components/Stepper";

import { ProblemCallout, useSecondsUntil } from "./OperatorSignIn";

interface Challenge {
  challengeId: string;
  phone: string;
  displayName: string;
  resendAvailableAt: number;
}

/**
 * The juristic office accepts a landlord's invitation (D-270): the office's name and a phone, then the SMS code — the
 * same two short steps as a sign-up. The API links the juristic tenant the person already runs (or creates its free
 * workspace); the tokens are set by the Server Action and the workspace opens.
 */
export function WorkspaceAccept({ code, workspaceHref }: { code: string; workspaceHref: string }) {
  const t = useTranslations("auth");
  const w = useTranslations("owner.collections.join");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [pending, startTransition] = useTransition();
  const wait = useSecondsUntil(challenge?.resendAvailableAt);
  const details = useForm<{ displayName: string; phone: string }>({ defaultValues: { displayName: "", phone: "" } });
  const otp = useForm<{ code: string }>({ defaultValues: { code: "" } });
  const message = (key: string | undefined) => (key ? t(`errors.${key}`) : undefined);

  const send = (displayName: string, phone: string) =>
    startTransition(async () => {
      setProblem(null);
      const result = await requestWorkspaceOtp({ phone });
      if (!result.ok) return setProblem(result.problem);
      setChallenge({
        challengeId: result.data.challengeId,
        phone,
        displayName,
        resendAvailableAt: Date.parse(result.data.resendAvailableAt),
      });
      otp.reset({ code: "" });
    });

  const accept = (value: string) =>
    startTransition(async () => {
      if (!challenge) return;
      setProblem(null);
      const result = await acceptWorkspaceInvitation(code, {
        challengeId: challenge.challengeId,
        code: value,
        displayName: challenge.displayName,
      });
      if (!result.ok) {
        setProblem(result.problem);
        otp.reset({ code: "" });
        return;
      }
      window.location.assign(workspaceHref);
    });

  return (
    <div className="flex flex-col gap-6" data-testid="workspace-accept">
      <Stepper
        label={w("steps")}
        steps={[
          { id: "details", label: w("stepDetails") },
          { id: "verify", label: w("stepVerify") },
        ]}
        current={challenge ? 1 : 0}
        progressText={w("progress", { step: challenge ? 2 : 1, total: 2 })}
      />
      {!challenge ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={details.handleSubmit(({ displayName, phone }) => send(displayName.trim(), phone))}
          noValidate
        >
          <Field
            label={w("name")}
            hint={w("nameHint")}
            error={message(details.formState.errors.displayName?.message)}
            required
          >
            <Input
              autoComplete="organization"
              inputSize="lg"
              data-testid="join-name"
              {...details.register("displayName", { validate: isDisplayName })}
            />
          </Field>
          <Controller
            control={details.control}
            name="phone"
            rules={{ validate: isPhone }}
            render={({ field, fieldState }) => (
              <Field
                label={t("signIn.phone")}
                hint={w("phoneHint")}
                error={message(fieldState.error?.message)}
                required
              >
                <PhoneInput value={field.value} onChange={field.onChange} name={field.name} inputSize="lg" />
              </Field>
            )}
          />
          <ProblemCallout problem={problem} />
          <Button type="submit" size="lg" block loading={pending} data-testid="join-send">
            {t("signIn.sendCode")}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={otp.handleSubmit(({ code: value }) => accept(value))}
          noValidate
        >
          <Controller
            control={otp.control}
            name="code"
            rules={{ validate: isOtpCode }}
            render={({ field, fieldState }) => (
              <Field
                label={t("signIn.code")}
                hint={t("signIn.codeHint", { phone: formatPhone(challenge.phone) })}
                error={message(fieldState.error?.message)}
                required
              >
                <OTPInput
                  value={field.value}
                  onChange={field.onChange}
                  onComplete={(value) => !pending && accept(value)}
                  digitLabel={(index) => t("signIn.codeDigit", { index: index + 1 })}
                  autoFocus
                  disabled={pending}
                />
              </Field>
            )}
          />
          <ProblemCallout problem={problem} />
          <Button type="submit" size="lg" block loading={pending} data-testid="join-accept">
            {w("accept")}
          </Button>
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setChallenge(null);
                setProblem(null);
              }}
            >
              {t("signIn.changePhone")}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={wait > 0 || pending}
              onClick={() => send(challenge.displayName, challenge.phone)}
            >
              {wait > 0 ? t("signIn.resendIn", { seconds: wait }) : t("signIn.resend")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
