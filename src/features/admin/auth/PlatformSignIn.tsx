"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { otpCodeSchema, passwordLoginSchema } from "@/domain/forms/auth";
import { authProblemMessage } from "@/features/shared/auth/problemMessage";
import { platformActivateTotp, platformEnrollTotp, platformLogin, type ActionProblem } from "@/lib/auth/actions";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

/**
 * Platform sign-in (audience `platform`, contract §4, D-164): email + password + TOTP, always. An
 * account without an authenticator gets `auth.totp_enrollment_required` with a one-time token; the
 * enrolment step shows the QR code and secret once, and the first code activates TOTP and signs in.
 */
export function PlatformSignIn({ consoleHref }: { consoleHref: string }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [enrolment, setEnrolment] = useState<{
    token: string;
    secret: string;
    otpauthUri: string;
    qrSvg: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const credentials = useForm<z.input<typeof passwordLoginSchema>>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "", totpCode: "" },
  });
  const activation = useForm<{ code: string }>({
    resolver: zodResolver(z.object({ code: otpCodeSchema })),
    defaultValues: { code: "" },
  });
  const message = (key: string | undefined) => (key ? t(`errors.${key}`) : undefined);

  const signIn = credentials.handleSubmit((values) =>
    startTransition(async () => {
      setProblem(null);
      const result = await platformLogin(values);
      if (result.ok) return window.location.assign(consoleHref);
      if (result.problem.code === "auth.totp_required") return setNeedsTotp(true);
      if (result.problem.code === "auth.totp_enrollment_required" && result.problem.enrollmentToken) {
        const enrolled = await platformEnrollTotp({ enrollmentToken: result.problem.enrollmentToken });
        if (!enrolled.ok) return setProblem(enrolled.problem);
        setEnrolment({ token: result.problem.enrollmentToken, ...enrolled.data });
        return;
      }
      setProblem(result.problem);
    }),
  );

  const activate = activation.handleSubmit(({ code }) =>
    startTransition(async () => {
      if (!enrolment) return;
      setProblem(null);
      const result = await platformActivateTotp({ enrollmentToken: enrolment.token, code });
      if (result.ok) return window.location.assign(consoleHref);
      setProblem(result.problem);
      activation.reset({ code: "" });
    }),
  );

  const errorBox = problem ? (
    <Callout tone="danger">
      <span data-testid="auth-error" data-code={problem.code}>
        {authProblemMessage(t, problem)}
      </span>
      {problem.requestId ? (
        <span className="text-subtle mt-1 block font-mono text-xs">
          {common("requestId")}: {problem.requestId}
        </span>
      ) : null}
    </Callout>
  ) : null;

  if (enrolment) {
    return (
      <form className="flex flex-col gap-4" onSubmit={activate} noValidate data-testid="totp-enrolment">
        <h2 className="text-lg font-semibold">{t("enrol.title")}</h2>
        <p className="text-muted text-sm">{t("enrol.body")}</p>
        {/* Rendered on the server from the otpauth URI; a data: URL keeps it inside the CSP. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URL, nothing to optimise */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolment.qrSvg)}`}
          alt={t("enrol.qr")}
          width={192}
          height={192}
          className="bg-surface mx-auto rounded-md border p-2"
        />
        <div>
          <p className="text-sm font-medium">{t("enrol.secret")}</p>
          <p className="bg-bg-subtle mt-1 rounded-md p-2 font-mono text-sm break-all" data-testid="totp-secret">
            {enrolment.secret}
          </p>
          <p className="text-muted mt-1 text-xs">{t("enrol.secretWarning")}</p>
          <a className="text-primary text-sm underline underline-offset-4" href={enrolment.otpauthUri}>
            {t("enrol.openApp")}
          </a>
        </div>
        <Field label={t("signIn.totp")} error={message(activation.formState.errors.code?.message)} required>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            inputSize="lg"
            {...activation.register("code")}
          />
        </Field>
        {errorBox}
        <Button type="submit" size="lg" block loading={pending}>
          {t("enrol.activate")}
        </Button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={signIn} noValidate>
      <Field label={t("signIn.email")} error={message(credentials.formState.errors.email?.message)} required>
        <Input type="email" autoComplete="username" inputSize="lg" {...credentials.register("email")} />
      </Field>
      <Field label={t("signIn.password")} error={message(credentials.formState.errors.password?.message)} required>
        <Input type="password" autoComplete="current-password" inputSize="lg" {...credentials.register("password")} />
      </Field>
      {needsTotp ? (
        <Field
          label={t("signIn.totp")}
          hint={t("signIn.totpHint")}
          error={message(credentials.formState.errors.totpCode?.message)}
          required
        >
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            inputSize="lg"
            autoFocus
            {...credentials.register("totpCode")}
          />
        </Field>
      ) : null}
      {errorBox}
      <Button type="submit" size="lg" block loading={pending}>
        {t("signIn.submit")}
      </Button>
    </form>
  );
}
