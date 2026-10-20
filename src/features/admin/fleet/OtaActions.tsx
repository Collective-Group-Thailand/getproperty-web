"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { RINGS } from "./constants";

/** The signed manifest pasted as the build produced it, or the reason it cannot be sent. */
export function parseManifest(raw: string): { manifest: Schemas["OtaManifestDto"] } | { error: "json" | "shape" } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: "json" };
  }
  const manifest = value as Partial<Schemas["OtaManifestDto"]> | null;
  if (
    !manifest ||
    typeof manifest !== "object" ||
    typeof manifest.version !== "string" ||
    typeof manifest.arch !== "string" ||
    typeof manifest.artifact?.url !== "string" ||
    typeof manifest.artifact.sha256 !== "string" ||
    typeof manifest.signature?.value !== "string"
  ) {
    return { error: "shape" };
  }
  return { manifest: manifest as Schemas["OtaManifestDto"] };
}

/**
 * `POST /v1/admin/ota/releases` — registers a release from its signed manifest (D-131): the console
 * never signs; the API verifies the ed25519 signature against the platform key (`ota.signature_invalid`).
 */
export function RegisterRelease() {
  const t = useTranslations("admin.fleet.ota");
  return (
    <FormDialog
      label={t("register")}
      icon={IconUpload}
      variant="primary"
      testId="register-release"
      title={t("registerTitle")}
      description={t("registerHint")}
      submitLabel={t("register")}
      successMessage={t("registered")}
      size_="lg"
      onSubmit={(data) => {
        const parsed = parseManifest(String(data.get("manifest") ?? ""));
        if ("error" in parsed)
          return Promise.reject(new Error(t(parsed.error === "json" ? "manifestJson" : "manifestShape")));
        return unwrap(
          browserApi().POST("/v1/admin/ota/releases", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: { manifest: parsed.manifest, notes: text(data, "notes") ?? null },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("manifest")} hint={t("manifestHint")} required error={errors.manifest}>
            <Textarea name="manifest" rows={10} required className="font-mono text-xs" data-testid="release-manifest" />
          </Field>
          <Field label={t("notes")} error={errors.notes}>
            <Input name="notes" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * `POST /v1/admin/ota/releases/{id}/rollouts` — a rollout of the release to one ring (D-183: canary →
 * pilot → all, each after the previous ring completed; the API refuses with `ota.ring_order`) with the
 * share of failures that pauses it.
 */
export function PlanRollout({ release }: { release: Schemas["OtaReleaseDto"] }) {
  const t = useTranslations("admin.fleet.ota");
  const rings = useTranslations("admin.fleet.ring");
  const router = useRouter();
  return (
    <FormDialog
      label={t("plan")}
      icon={IconAdd}
      size="sm"
      testId={`plan-${release.version}-${release.arch}`}
      title={t("planTitle", { version: release.version, arch: release.arch })}
      description={t("planHint")}
      submitLabel={t("plan")}
      successMessage={t("planned")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/ota/releases/{releaseId}/rollouts", {
            params: { path: { releaseId: release.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              ring: (text(data, "ring") ?? "canary") as Schemas["OtaRing"],
              maxFailuresPct: text(data, "maxFailuresPct"),
              notes: text(data, "notes") ?? null,
            },
          }),
        )
      }
      onDone={(rollout) => {
        const created = rollout as Schemas["OtaRolloutDto"];
        router.push(`/ota/rollouts/${created.id}`);
      }}
    >
      {(errors) => (
        <>
          <Field label={t("ring")} required error={errors.ring}>
            <NativeSelect
              name="ring"
              options={RINGS.map((ring) => ({ value: ring, label: rings(ring) }))}
              data-testid="rollout-ring"
            />
          </Field>
          <Field label={t("maxFailures")} hint={t("maxFailuresHint")} error={errors.maxFailuresPct}>
            <Input name="maxFailuresPct" inputMode="decimal" defaultValue="10.00" pattern="\d{1,3}(\.\d{1,2})?" />
          </Field>
          <Field label={t("notes")} error={errors.notes}>
            <Input name="notes" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** start / pause / resume / abort as the rollout's `nextActions` offer them; abort is typed (the version). */
export function RolloutControls({ rollout, onChanged }: { rollout: Schemas["OtaRolloutDto"]; onChanged: () => void }) {
  const t = useTranslations("admin.fleet.ota");
  const actions = new Set(rollout.nextActions);
  const path = { rolloutId: rollout.id };
  const label = `${rollout.release.version} · ${rollout.ring}`;
  return (
    <div className="flex flex-wrap gap-2" data-testid="rollout-controls">
      {actions.has("start") ? (
        <ConfirmAction
          label={t("start")}
          icon={IconPlay}
          testId="rollout-start"
          title={t("startTitle", { label })}
          description={t("startBody", { count: rollout.devices.length })}
          confirmLabel={t("start")}
          successMessage={t("started")}
          onDone={onChanged}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/admin/ota/rollouts/{rolloutId}/actions/start", {
                params: { path, header: { "Idempotency-Key": key } },
              }),
            )
          }
        />
      ) : null}
      {actions.has("pause") ? (
        <ConfirmAction
          label={t("pause")}
          variant="secondary"
          testId="rollout-pause"
          title={t("pauseTitle", { label })}
          description={t("pauseBody")}
          confirmLabel={t("pause")}
          successMessage={t("paused")}
          onDone={onChanged}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/admin/ota/rollouts/{rolloutId}/actions/pause", { params: { path } }))
          }
        />
      ) : null}
      {actions.has("resume") ? (
        <ConfirmAction
          label={t("resume")}
          icon={IconPlay}
          testId="rollout-resume"
          title={t("resumeTitle", { label })}
          description={t("resumeBody")}
          confirmLabel={t("resume")}
          successMessage={t("resumed")}
          onDone={onChanged}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/admin/ota/rollouts/{rolloutId}/actions/resume", { params: { path } }))
          }
        />
      ) : null}
      {actions.has("abort") ? (
        <ConfirmAction
          label={t("abort")}
          variant="destructive"
          tone="destructive"
          testId="rollout-abort"
          title={t("abortTitle", { label })}
          description={t("abortBody")}
          confirmLabel={t("abort")}
          phrase={rollout.release.version}
          successMessage={t("aborted")}
          onDone={onChanged}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/admin/ota/rollouts/{rolloutId}/actions/abort", {
                params: { path, header: { "Idempotency-Key": key } },
              }),
            )
          }
        />
      ) : null}
    </div>
  );
}
