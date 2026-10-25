"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { isDisplayName, isOtpCode, isPhone } from "@/domain/forms/auth-rules";
import { requestLandlordSignUpOtp, signUpLandlord, type ActionProblem } from "@/lib/auth/actions";
import { formatPhone } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { OTPInput } from "@/ui/components/OTPInput";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Stepper } from "@/ui/components/Stepper";

import { OAuthButtons, type OAuthProviderKey } from "./OAuthButtons";
import { OAuthError } from "./OAuthError";
import { ProblemCallout, useSecondsUntil } from "./OperatorSignIn";

const noSubscription = () => () => {};

interface Challenge {
  challengeId: string;
  phone: string;
  displayName: string;
  resendAvailableAt: number;
}

/**
 * Landlord self sign-up (B7.1, F6.1, D-251): a name and a phone, then the SMS code — two short steps, no
 * invitation, no company data (that comes later in settings). Or the name and Google / Apple / LINE (D-255, D-283). The tokens are set by the Server Action; the
 * page then opens the portfolio, where the first thing to do is add a unit.
 */
export function LandlordSignUp({
  portfolioHref,
  locale,
  providers = [],
  oauthError,
}: {
  portfolioHref: string;
  locale: Locale;
  /** Google / Apple / LINE as the server offers them (D-255, D-283): the name typed here goes along. */
  providers?: readonly OAuthProviderKey[];
  oauthError?: string;
}) {
  const t = useTranslations("auth");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [pending, startTransition] = useTransition();
  const wait = useSecondsUntil(challenge?.resendAvailableAt);
  const details = useForm<{ displayName: string; phone: string }>({ defaultValues: { displayName: "", phone: "" } });
  const code = useForm<{ code: string }>({ defaultValues: { code: "" } });
  const message = (key: string | undefined) => (key ? t(`errors.${key}`) : undefined);
  // Hydrated: the provider buttons check the name before leaving (a plain link before that).
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const send = (displayName: string, phone: string) =>
    startTransition(async () => {
      setProblem(null);
      const result = await requestLandlordSignUpOtp({ phone });
      if (!result.ok) return setProblem(result.problem);
      setChallenge({
        challengeId: result.data.challengeId,
        phone,
        displayName,
        resendAvailableAt: Date.parse(result.data.resendAvailableAt),
      });
      code.reset({ code: "" });
    });

  const create = (value: string) =>
    startTransition(async () => {
      if (!challenge) return;
      setProblem(null);
      const result = await signUpLandlord({
        challengeId: challenge.challengeId,
        code: value,
        displayName: challenge.displayName,
      });
      if (!result.ok) {
        setProblem(result.problem);
        code.reset({ code: "" });
        return;
      }
      window.location.assign(result.data.created ? `${portfolioHref}?welcome=1` : portfolioHref);
    });

  return (
    <div className="flex flex-col gap-6" data-testid="landlord-signup" data-ready={ready ? "true" : "false"}>
      <OAuthError code={oauthError} />
      <Stepper
        label={t("signUp.steps.label")}
        steps={[
          { id: "details", label: t("signUp.steps.details") },
          { id: "verify", label: t("signUp.steps.verify") },
        ]}
        current={challenge ? 1 : 0}
        progressText={t("signUp.steps.progress", { step: challenge ? 2 : 1, total: 2 })}
      />
      {!challenge ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={details.handleSubmit(({ displayName, phone }) => send(displayName.trim(), phone))}
          noValidate
        >
          <Field
            label={t("signUp.name")}
            hint={t("signUp.nameHint")}
            error={message(details.formState.errors.displayName?.message)}
            required
          >
            <Input
              autoComplete="name"
              inputSize="lg"
              data-testid="signup-name"
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
                hint={t("signIn.phoneHint")}
                error={message(fieldState.error?.message)}
                required
              >
                <PhoneInput value={field.value} onChange={field.onChange} name={field.name} inputSize="lg" />
              </Field>
            )}
          />
          <ProblemCallout problem={problem} />
          <Button type="submit" size="lg" block loading={pending}>
            {t("signIn.sendCode")}
          </Button>
          <OAuthButtons
            providers={providers}
            intent="signup"
            locale={locale}
            beforeNavigate={() => {
              const name = details.getValues("displayName").trim();
              const valid = isDisplayName(name);
              if (valid !== true) {
                details.setError("displayName", { message: typeof valid === "string" ? valid : "nameRequired" });
                return false;
              }
              return name;
            }}
          />
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={code.handleSubmit(({ code: value }) => create(value))}
          noValidate
        >
          <Controller
            control={code.control}
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
                  onComplete={(value) => !pending && create(value)}
                  digitLabel={(index) => t("signIn.codeDigit", { index: index + 1 })}
                  autoFocus
                  disabled={pending}
                />
              </Field>
            )}
          />
          <ProblemCallout problem={problem} />
          <Button type="submit" size="lg" block loading={pending}>
            {t("signUp.create")}
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
