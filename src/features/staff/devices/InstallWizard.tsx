"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense, useId, useMemo, useState } from "react";

import { formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { FrozenSubmission, objectIdentity, PhotoUploads } from "@/lib/api/submission";
import type { StaffMeterPoint } from "./server";
import type { Schemas } from "@/lib/api/types";
import { uploadFile, UploadError } from "@/lib/pwa/queue";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { isCompleteDecimal } from "@/ui/lib/decimal";
import { lazyWarm } from "@/ui/lib/lazy";
import { ScanButton } from "@/ui/components/ScanButton";
import { Stepper } from "@/ui/components/Stepper";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconForward } from "@/ui/icons/glyphs/forward";

import { useCameraLabels, useKeypadLabels, useScanLabels } from "../shared/labels";
import { meterUnit } from "../shared/units";
import { SelectField, TextField } from "./fields";
import { KNOWN_DRIVERS, type WiringDraft, validateMeterDevice, validateWiring, wiringInput } from "./wiring";

// The camera, the keypad and the command button load on first use: the staff budget is 200 KB (D-179).
const CameraCapture = lazyWarm(() => import("@/ui/components/CameraCapture").then((module) => module.CameraCapture));
const NumericKeypad = lazyWarm(() => import("@/ui/components/NumericKeypad").then((module) => module.NumericKeypad));
const IdentifyButton = lazyWarm(() => import("./IdentifyButton").then((module) => module.IdentifyButton));

type Step = "device" | "point" | "wiring" | "reading" | "done";
const STEPS: Step[] = ["device", "point", "wiring", "reading", "done"];

interface Failure {
  detail: string;
  requestId?: string;
  fields?: Schemas["ProblemFieldError"][];
}

/**
 * The meter binding wizard (F4 4.3, D-033, D-131): scan the meter device (QR or serial; a device in
 * the building's inventory fills in model, vendor and driver) → choose the meter point (`asset_item`)
 * → the gateway, bus and Modbus address or GPIO pin → photograph the physical register and type the
 * install reading (it becomes the channel's first, staff-confirmed manual reading) → install
 * (`POST /v1/staff/devices/actions/install`: one Idempotency-Key per submission with a frozen body — the photo is
 * uploaded once and `installedAt` stamped at the first attempt, so a retry after a lost answer replays the recorded
 * install instead of `idempotency.key_reused`, review M1) → flash the gateway's LED
 * to find it again → done: the meter assignment reads through the gateway from now on.
 */
export function InstallWizard({
  points,
  gateways,
  inventory,
  drivers,
  initial,
}: {
  /** Meter points of the building with their open channel; `null` while the API cannot list them. */
  points: StaffMeterPoint[] | null;
  gateways: Schemas["FleetDeviceDto"][];
  /** Meter devices assigned to the building, not installed yet. */
  inventory: Schemas["FleetDeviceDto"][];
  /** The edge driver catalogue (`GET /v1/staff/meter-drivers`); `null` → the known keys of D-013. */
  drivers: Schemas["MeterDriverDto"][] | null;
  initial: { meter?: string; gateway?: string };
}) {
  const t = useTranslations("staff.devices.install");
  const tw = useTranslations("staff.devices.wiring");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const scanLabels = useScanLabels();
  const cameraLabels = useCameraLabels();
  const keypadLabels = useKeypadLabels();
  const formId = useId();
  const [submission] = useState(() => new FrozenSubmission<Schemas["DeviceInstallDto"]>());
  const [uploads] = useState(() => new PhotoUploads());

  const free = useMemo(() => (points ?? []).filter((point) => point.channel === null), [points]);
  const [step, setStep] = useState<Step>(initial.meter ? "device" : "device");
  const [device, setDevice] = useState({ serial: "", model: "", vendor: "", driver: "" });
  const [pointId, setPointId] = useState<string | null>(
    initial.meter && free.some((point) => point.assetItemId === initial.meter) ? initial.meter : null,
  );
  const [wiring, setWiring] = useState<WiringDraft>({
    gatewayDeviceId: initial.gateway ?? gateways[0]?.id ?? "",
    busType: "modbus_rtu",
    busId: "bus1",
    address: "",
    pin: "",
    litresPerPulse: "",
  });
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [register, setRegister] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [installed, setInstalled] = useState<Schemas["DeviceInstalledDto"] | null>(null);

  const driverKeys = useMemo(
    () =>
      drivers
        ? drivers.map((driver) => ({
            key: driver.key,
            label: `${driver.vendor} ${driver.models.join(" / ")} (${driver.key})`,
          }))
        : KNOWN_DRIVERS.map((key) => ({ key, label: tw(`driver.${key}`) })),
    [drivers, tw],
  );
  const point = free.find((candidate) => candidate.assetItemId === pointId) ?? null;
  const gateway = gateways.find((candidate) => candidate.id === wiring.gatewayDeviceId) ?? null;
  const deviceErrors = validateMeterDevice(device);
  const wiringErrors = validateWiring(wiring);
  const index = STEPS.indexOf(step);
  const go = (next: Step) => {
    setFailure(null);
    setStep(next);
  };

  const fromScan = (serial: string) => {
    const known = inventory.find((candidate) => candidate.serial.toLowerCase() === serial.toLowerCase());
    setDevice({
      serial: known?.serial ?? serial,
      model: known?.model ?? device.model,
      vendor: known?.vendor ?? device.vendor,
      driver: known?.driver ?? device.driver,
    });
  };

  const install = async () => {
    if (!point || !photo || !gateway) return;
    setBusy(true);
    setFailure(null);
    try {
      const draft = {
        meterAssetItemId: point.assetItemId,
        gatewayDeviceId: gateway.id,
        meterDevice: {
          serial: device.serial.trim(),
          model: device.model.trim(),
          vendor: device.vendor.trim(),
          driver: device.driver,
        },
        wiring: wiringInput(wiring),
        installRegister: register,
      };
      const file = photo.file;
      const { key, body } = await submission.prepare({ ...draft, photo: objectIdentity(file) }, async () => ({
        ...draft,
        installedAt: new Date().toISOString(),
        photoDocumentId: await uploads.upload(file, () =>
          uploadFile({
            blob: file,
            fileName: file.name,
            kind: "meter_photo",
            scopeType: "asset_item",
            scopeId: draft.meterAssetItemId,
            bodyField: "photoDocumentId",
          }),
        ),
      }));
      const result = await unwrap(
        browserApi().POST("/v1/staff/devices/actions/install", {
          params: { header: { "Idempotency-Key": key } },
          body,
        }),
      );
      setInstalled(result);
      go("done");
    } catch (error) {
      if (isApiError(error) && error.code === "idempotency.key_reused") submission.forget();
      if (isApiError(error))
        setFailure({ detail: error.detail || error.code, requestId: error.requestId, fields: error.errors });
      else if (error instanceof UploadError && error.problem.code !== "network")
        setFailure({ detail: error.problem.detail || error.problem.code, requestId: error.problem.requestId });
      else setFailure({ detail: t("offline") });
    } finally {
      setBusy(false);
    }
  };

  const steps = STEPS.map((id) => ({ id, label: t(`steps.${id}`) }));

  return (
    <section
      className="flex flex-col gap-5 py-6"
      aria-labelledby={`${formId}-title`}
      data-testid="install-wizard"
      data-step={step}
    >
      <h1 id={`${formId}-title`} className="text-2xl font-semibold">
        {t("title")}
      </h1>
      <Stepper
        steps={steps}
        current={index}
        label={t("stepsLabel")}
        progressText={t("stepOf", { step: index + 1, total: steps.length })}
      />
      <Suspense fallback={<p className="text-muted py-6 text-center">{t("loading")}</p>}>
        {failure ? (
          <Callout tone="danger" title={t("errorTitle")}>
            {failure.detail}
            {failure.fields?.length ? (
              <ul className="mt-1 list-disc ps-5">
                {failure.fields.map((field) => (
                  <li key={`${field.path}-${field.code}`}>{field.message}</li>
                ))}
              </ul>
            ) : null}
            {failure.requestId ? (
              <span className="text-muted block font-mono text-xs">
                {common("requestId")}: {failure.requestId}
              </span>
            ) : null}
          </Callout>
        ) : null}

        {step === "device" ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted">{t("deviceHint")}</p>
            <ScanButton label={t("scanMeter")} labels={scanLabels} onScan={fromScan} />
            {inventory.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {inventory.map((candidate) => (
                  <Button key={candidate.id} variant="secondary" size="lg" onClick={() => fromScan(candidate.serial)}>
                    <span className="font-mono">{candidate.serial}</span>
                  </Button>
                ))}
              </div>
            ) : null}
            <TextField
              label={t("serial")}
              value={device.serial}
              onChange={(serial) => setDevice({ ...device, serial })}
              mono
              testId="device-serial"
            />
            <TextField label={t("model")} value={device.model} onChange={(model) => setDevice({ ...device, model })} />
            <TextField
              label={t("vendor")}
              value={device.vendor}
              onChange={(vendor) => setDevice({ ...device, vendor })}
            />
            <SelectField
              label={t("driver")}
              value={device.driver}
              onChange={(driver) => setDevice({ ...device, driver })}
              options={[
                { value: "", label: t("choose") },
                ...driverKeys.map((driver) => ({ value: driver.key, label: driver.label })),
                ...(device.driver && !driverKeys.some((driver) => driver.key === device.driver)
                  ? [{ value: device.driver, label: device.driver }]
                  : []),
              ]}
            />
            <Button
              size="xl"
              block
              iconEnd={IconForward}
              disabled={deviceErrors.length > 0}
              onClick={() => go("point")}
            >
              {t("next")}
            </Button>
          </div>
        ) : null}

        {step === "point" ? (
          <div className="flex flex-col gap-4">
            {points === null ? (
              <Callout tone="warning">{t("pointsUnavailable")}</Callout>
            ) : free.length === 0 ? (
              <Callout tone="info">{t("noFreePoints")}</Callout>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-muted mb-1 text-sm font-medium">{t("pointLabel")}</legend>
                {free.map((candidate) => (
                  <label key={candidate.assetItemId} className="relative">
                    <input
                      type="radio"
                      name={`${formId}-point`}
                      value={candidate.assetItemId}
                      checked={pointId === candidate.assetItemId}
                      onChange={() => setPointId(candidate.assetItemId)}
                      className="peer sr-only"
                    />
                    <span className="rounded-control border-border-strong bg-surface peer-checked:border-primary peer-checked:bg-primary-subtle peer-focus-visible:outline-focus-ring flex min-h-14 cursor-pointer flex-col justify-center border-2 px-4 py-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      <span className="font-semibold">
                        {candidate.unitNo ?? candidate.commonAreaLabel ?? candidate.code} ·{" "}
                        {t(`utility.${candidate.utility}`)}
                      </span>
                      <span className="text-muted text-sm">
                        {candidate.code}
                        {candidate.floorName ? ` · ${candidate.floorName}` : null}
                        {candidate.lastRegister
                          ? ` · ${t("last", { value: formatUnits(candidate.lastRegister, meterUnit(candidate.utility), locale) })}`
                          : null}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <Button size="xl" block iconEnd={IconForward} disabled={!point} onClick={() => go("wiring")}>
              {t("next")}
            </Button>
            <Button variant="ghost" size="lg" iconStart={IconBack} onClick={() => go("device")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "wiring" ? (
          <div className="flex flex-col gap-4">
            {gateways.length === 0 ? <Callout tone="warning">{t("noGateway")}</Callout> : null}
            <SelectField
              label={tw("gateway")}
              value={wiring.gatewayDeviceId}
              onChange={(gatewayDeviceId) => setWiring({ ...wiring, gatewayDeviceId })}
              options={gateways.map((candidate) => ({ value: candidate.id, label: candidate.serial }))}
            />
            <SelectField
              label={tw("busType")}
              value={wiring.busType}
              onChange={(busType) => setWiring({ ...wiring, busType: busType as WiringDraft["busType"] })}
              options={[
                { value: "modbus_rtu", label: tw("bus.modbus_rtu") },
                { value: "gpio", label: tw("bus.gpio") },
              ]}
            />
            <TextField
              label={tw("busId")}
              value={wiring.busId}
              onChange={(busId) => setWiring({ ...wiring, busId })}
              mono
            />
            {wiring.busType === "modbus_rtu" ? (
              <TextField
                label={tw("address")}
                hint={tw("addressHint")}
                value={wiring.address}
                numeric
                onChange={(address) => setWiring({ ...wiring, address })}
                testId="wiring-address"
              />
            ) : (
              <>
                <TextField
                  label={tw("pin")}
                  hint={tw("pinHint")}
                  value={wiring.pin}
                  numeric
                  onChange={(pin) => setWiring({ ...wiring, pin })}
                />
                <TextField
                  label={tw("litresPerPulse")}
                  value={wiring.litresPerPulse}
                  numeric
                  onChange={(litresPerPulse) => setWiring({ ...wiring, litresPerPulse })}
                />
              </>
            )}
            {wiringErrors.length > 0 && (wiring.address || wiring.pin) ? (
              <Callout tone="warning">
                <ul role="alert">
                  {wiringErrors.map((error) => (
                    <li key={error}>{tw(`error.${error}`)}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
            <Button
              size="xl"
              block
              iconEnd={IconForward}
              disabled={wiringErrors.length > 0 || !gateway}
              onClick={() => go("reading")}
              data-testid="wiring-next"
            >
              {t("next")}
            </Button>
            <Button variant="ghost" size="lg" iconStart={IconBack} onClick={() => go("point")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "reading" && point ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted">{t("readingHint")}</p>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- the register photo just taken
              <img
                src={photo.url}
                alt={t("photoAlt")}
                className="rounded-control aspect-[4/3] w-full object-cover"
                data-testid="install-photo"
              />
            ) : (
              <CameraCapture
                label={t("shoot")}
                hint={t("guide")}
                labels={cameraLabels}
                guide="meter"
                fileBaseName={`install-${point.code}`}
                onCapture={([file]) => file && setPhoto({ file, url: URL.createObjectURL(file) })}
              />
            )}
            {photo ? (
              <Button variant="ghost" size="lg" onClick={() => setPhoto(null)}>
                {t("retake")}
              </Button>
            ) : null}
            <NumericKeypad
              label={t("register")}
              unit={point.utility === "electric" ? "kWh" : "m³"}
              labels={keypadLabels}
              value={register}
              onChange={setRegister}
              maxDecimals={3}
              hint={
                point.lastRegister
                  ? t("last", { value: formatUnits(point.lastRegister, meterUnit(point.utility), locale) })
                  : undefined
              }
            />
            <Button
              size="xl"
              block
              loading={busy}
              disabled={!photo || !isCompleteDecimal(register)}
              onClick={() => void install()}
              data-testid="install-submit"
            >
              {t("submit")}
            </Button>
            <Button variant="ghost" size="lg" iconStart={IconBack} onClick={() => go("wiring")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "done" && installed && point ? (
          <div className="flex flex-col gap-4" data-testid="install-done">
            <Callout tone="success" title={t("doneTitle")}>
              {t("doneBody", {
                serial: installed.device.serial,
                meter: point.unitNo ?? point.code,
                register: formatUnits(register, meterUnit(point.utility), locale),
              })}
            </Callout>
            {gateway ? <IdentifyButton gatewayId={gateway.id} /> : null}
            <Button asChild size="xl" block>
              <Link href="/devices/install">{t("another")}</Link>
            </Button>
            <Button asChild variant="secondary" size="xl" block>
              <Link href="/devices">{t("toDevices")}</Link>
            </Button>
          </div>
        ) : null}
      </Suspense>
    </section>
  );
}
