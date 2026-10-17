"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { isEmail, isOptionalOtpCode, isOtpCode, isPassword, isPhone } from "@/domain/forms/auth-rules";
import {
  operatorPasswordLogin,
  requestOperatorOtp,
  verifyOperatorOtp,
  type ActionProblem,
  type OperatorNext,
} from "@/lib/auth/actions";
import { formatPhone } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { OTPInput } from "@/ui/components/OTPInput";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { authProblemMessage } from "./problemMessage";

export interface OperatorSignInProps {
  zone: "owner" | "staff";
  /** Where to go after signing in, already locale-prefixed by the page. */
  consoleHref: string;
  selectTenantHref: string;
  /** Invitation code from the SMS link or QR (D-145), passed through to `otp/verify`. */
  invitationCode?: string;
  /** Staff sign in by OTP only (00-master-plan.md §4); owners may also use email + password + TOTP. */
  allowPassword?: boolean;
}

type Method = "otp" | "password";

/**
 * Operator sign-in (audience `operator`, F1 1.2): phone OTP first, email + password (+ TOTP when the
 * account has it) as the alternative. Every step is a Server Action; the browser never sees a token.
 * After success the page reloads into the console (or the tenant picker), so every Server Component
 * renders with the new session.
 */
export function OperatorSignIn({
  zone,
  consoleHref,
  selectTenantHref,
  invitationCode,
  allowPassword = true,
}: OperatorSignInProps) {
  const t = useTranslations("auth");
  const [method, setMethod] = useState<Method>("otp");

  const done = (result: OperatorNext) => {
    window.location.assign(result.next === "console" ? consoleHref : selectTenantHref);
  };

  return (
    <div className="flex flex-col gap-6">
      {invitationCode ? <Callout tone="info">{t("signIn.invitation")}</Callout> : null}
      {allowPassword ? (
        <SegmentedControl
          label={t("signIn.method.label")}
          value={method}
          onValueChange={(value) => setMethod(value as Method)}
          options={[
            { value: "otp", label: t("signIn.method.otp"), icon: "phone" },
            { value: "password", label: t("signIn.method.password"), icon: "key" },
          ]}
          className="w-full [&>*]:flex-1"
        />
      ) : null}
      {method === "otp" ? (
        <OtpSignIn zone={zone} invitationCode={invitationCode} onDone={done} />
      ) : (
        <PasswordSignIn zone={zone} onDone={done} />
      )}
    </div>
  );
}

function ProblemCallout({ problem }: { problem: ActionProblem | null }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  if (!problem) return null;
  return (
    <Callout tone="danger">
      <span data-testid="auth-error" data-code={problem.code}>
        {authProblemMessage(t, problem)}
      </span>
      {problem.requestId ? (
        <span className="text-muted mt-1 block font-mono text-xs">
          {common("requestId")}: {problem.requestId}
        </span>
      ) : null}
    </Callout>
  );
}

interface Challenge {
  challengeId: string;
  phone: string;
  resendAvailableAt: number;
}

function useSecondsUntil(at: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [at]);
  return at ? Math.max(0, Math.ceil((at - now) / 1000)) : 0;
}

function OtpSignIn({
  zone,
  invitationCode,
  onDone,
}: {
  zone: "owner" | "staff";
  invitationCode?: string;
  onDone: (next: OperatorNext) => void;
}) {
  const t = useTranslations("auth");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [pending, startTransition] = useTransition();
  const wait = useSecondsUntil(challenge?.resendAvailableAt);

  const phone = useForm<{ phone: string }>({ defaultValues: { phone: "" } });
  const code = useForm<{ code: string }>({ defaultValues: { code: "" } });

  const send = (national: string) =>
    startTransition(async () => {
      setProblem(null);
      const result = await requestOperatorOtp({ phone: national });
      if (!result.ok) return setProblem(result.problem);
      setChallenge({
        challengeId: result.data.challengeId,
        phone: national,
        resendAvailableAt: Date.parse(result.data.resendAvailableAt),
      });
      code.reset({ code: "" });
    });

  const verify = (value: string) =>
    startTransition(async () => {
      if (!challenge) return;
      setProblem(null);
      const result = await verifyOperatorOtp(zone, { challengeId: challenge.challengeId, code: value, invitationCode });
      if (!result.ok) {
        setProblem(result.problem);
        code.reset({ code: "" });
        return;
      }
      onDone(result.data);
    });

  if (!challenge) {
    return (
      <form className="flex flex-col gap-4" onSubmit={phone.handleSubmit(({ phone: value }) => send(value))} noValidate>
        <Controller
          control={phone.control}
          name="phone"
          rules={{ validate: isPhone }}
          render={({ field, fieldState }) => (
            <Field
              label={t("signIn.phone")}
              hint={t("signIn.phoneHint")}
              error={fieldState.error?.message ? t(`errors.${fieldState.error.message}`) : undefined}
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
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={code.handleSubmit(({ code: value }) => verify(value))} noValidate>
      <Controller
        control={code.control}
        name="code"
        rules={{ validate: isOtpCode }}
        render={({ field, fieldState }) => (
          <Field
            label={t("signIn.code")}
            hint={t("signIn.codeHint", { phone: formatPhone(challenge.phone) })}
            error={fieldState.error?.message ? t(`errors.${fieldState.error.message}`) : undefined}
            required
          >
            <OTPInput
              value={field.value}
              onChange={field.onChange}
              onComplete={(value) => !pending && verify(value)}
              digitLabel={(index) => t("signIn.codeDigit", { index: index + 1 })}
              autoFocus
              disabled={pending}
            />
          </Field>
        )}
      />
      <ProblemCallout problem={problem} />
      <Button type="submit" size="lg" block loading={pending}>
        {t("signIn.verify")}
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
          onClick={() => send(challenge.phone)}
        >
          {wait > 0 ? t("signIn.resendIn", { seconds: wait }) : t("signIn.resend")}
        </Button>
      </div>
    </form>
  );
}

function PasswordSignIn({ zone, onDone }: { zone: "owner" | "staff"; onDone: (next: OperatorNext) => void }) {
  const t = useTranslations("auth");
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<{ email: string; password: string; totpCode: string }>({
    defaultValues: { email: "", password: "", totpCode: "" },
  });
  const message = (key: string | undefined) => (key ? t(`errors.${key}`) : undefined);

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      setProblem(null);
      const result = await operatorPasswordLogin(zone, values);
      if (result.ok) return onDone(result.data);
      if (result.problem.code === "auth.totp_required") {
        setNeedsTotp(true);
        return;
      }
      setProblem(result.problem);
    }),
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <Field label={t("signIn.email")} error={message(form.formState.errors.email?.message)} required>
        <Input type="email" autoComplete="username" inputSize="lg" {...form.register("email", { validate: isEmail })} />
      </Field>
      <Field label={t("signIn.password")} error={message(form.formState.errors.password?.message)} required>
        <Input
          type="password"
          autoComplete="current-password"
          inputSize="lg"
          {...form.register("password", { validate: isPassword })}
        />
      </Field>
      {needsTotp ? (
        <Field
          label={t("signIn.totp")}
          hint={t("signIn.totpHint")}
          error={message(form.formState.errors.totpCode?.message)}
          required
        >
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            inputSize="lg"
            maxLength={6}
            autoFocus
            {...form.register("totpCode", { validate: isOptionalOtpCode })}
          />
        </Field>
      ) : null}
      <ProblemCallout problem={problem} />
      <Button type="submit" size="lg" block loading={pending}>
        {t("signIn.submit")}
      </Button>
    </form>
  );
}
