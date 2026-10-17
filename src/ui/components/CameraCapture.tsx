"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "../icons";
import { IconCamera } from "../icons/glyphs/camera";
import { IconClose } from "../icons/glyphs/close";
import { IconImage } from "../icons/glyphs/image";
import { IconTorch } from "../icons/glyphs/torch";
import { IconTorchOff } from "../icons/glyphs/torch-off";
import { cn } from "../lib/cn";
import { compressImage, PHOTO_DEFAULTS, toFile, type CompressOptions } from "../lib/image";
import { Button } from "./Button";

export interface CameraCaptureLabels {
  /** The live view's accessible name ("Camera"). */
  viewfinder: string;
  torchOn: string;
  torchOff: string;
  /** Multi-shot: emits the shots taken ("Use {count} photos"). */
  done: (count: number) => string;
  /** Removes one shot ("Remove photo {index}"). */
  remove: (index: number) => string;
  /** Announced after a shot ("Photo {count} taken"). */
  taken: (count: number) => string;
  /** The alternative to the live camera: a photo from the gallery or the OS camera app. */
  chooseFile: string;
  /** Shown while the camera starts. */
  starting: string;
  /** Shown when the browser refused or has no camera — the file chooser stays available. */
  unavailable: string;
}

export interface CameraCaptureProps {
  /** Called with the compressed photo(s): one per shot, or all of them after "done" in multi-shot. */
  onCapture: (files: File[]) => void;
  /** The shutter button's name ("ถ่ายรูปมิเตอร์"). */
  label: string;
  /** Guidance inside the frame ("ให้ตัวเลขอยู่ในกรอบ"). */
  hint?: string;
  labels: CameraCaptureLabels;
  /** Several shots before handing them over (inspection items). */
  multiple?: boolean;
  maxShots?: number;
  /** The overlay: a wide box for a meter register, a tall one for a document, or none. */
  guide?: "meter" | "document" | "none";
  /** Compression budget (default 1600 px / 400 KB JPEG, `src/ui/lib/image.ts`). */
  compress?: CompressOptions;
  /** File name stem of the shots (`meter` → `meter-1734….jpg`). */
  fileBaseName?: string;
  disabled?: boolean;
  className?: string;
}

type CameraState = "starting" | "live" | "unavailable";

const hasCamera = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

interface Shot {
  file: File;
  url: string;
}

/** The torch is a constraint of the video track where the platform has one (Chrome on Android). */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * The staff camera (design-system.md §3 CameraCapture: rear camera, torch, guide frame, multi-shot,
 * client compression). A live `getUserMedia` view of the rear camera fills the column with a guide
 * frame for the register; the shutter grabs the current frame and compresses it on the device before
 * it is handed over (`compressImage`), so a photo is a few hundred KB in the offline queue and on 4G.
 * The torch toggle appears only where the track supports it. Where the camera is refused or missing
 * (or the user prefers), "choose a photo" opens the OS picker/camera app — the same compression applies.
 * The stream stops when the component unmounts.
 */
export function CameraCapture({
  onCapture,
  label,
  hint,
  labels,
  multiple = false,
  maxShots = 8,
  guide = "meter",
  compress,
  fileBaseName = "photo",
  disabled,
  className,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>(() => (hasCamera() ? "starting" : "unavailable"));
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const settings = { ...PHOTO_DEFAULTS, ...compress };

  useEffect(() => {
    let cancelled = false;
    if (!hasCamera()) return;
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      })
      .then(async (stream) => {
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const track = stream.getVideoTracks()[0];
        const capabilities = (track?.getCapabilities?.() ?? {}) as TorchCapabilities;
        setTorchAvailable(capabilities.torch === true);
        setState("live");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };
  }, []);

  const shotsRef = useRef<Shot[]>([]);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url)), []);

  const deliver = useCallback(
    (files: File[]) => {
      if (!multiple) {
        onCapture(files);
        return;
      }
      setShots((current) => {
        const next = [...current, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(
          0,
          maxShots,
        );
        setAnnouncement(labels.taken(next.length));
        return next;
      });
    },
    [labels, maxShots, multiple, onCapture],
  );

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || state !== "live" || busy) return;
    setBusy(true);
    try {
      const blob = await compressImage(video, settings);
      deliver([toFile(blob, `${fileBaseName}-${Date.now()}`)]);
      if (!multiple) setAnnouncement(labels.taken(1));
    } finally {
      setBusy(false);
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  const fromFiles = async (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const files = await Promise.all(
        chosen.map(async (file, index) =>
          toFile(await compressImage(file, settings), `${fileBaseName}-${Date.now()}-${index}`),
        ),
      );
      deliver(files);
    } finally {
      setBusy(false);
    }
  };

  const full = multiple && shots.length >= maxShots;

  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="camera-capture" data-state={state}>
      <div className="rounded-card relative overflow-hidden bg-black" style={{ aspectRatio: "3 / 4" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={labels.viewfinder}
          className={cn("absolute inset-0 size-full object-cover", state !== "live" && "invisible")}
          data-testid="camera-video"
        />
        {state === "live" && guide !== "none" ? (
          <div
            aria-hidden="true"
            className={cn(
              "rounded-control pointer-events-none absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-white",
              "shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]",
              guide === "meter" ? "aspect-[3/1] w-[82%]" : "aspect-[3/4] w-[78%]",
            )}
            data-testid="camera-guide"
          />
        ) : null}
        {hint && state === "live" ? (
          <p className="rounded-control absolute inset-x-3 bottom-3 bg-black/60 px-3 py-2 text-center text-base text-white">
            {hint}
          </p>
        ) : null}
        {state !== "live" ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-base text-white">
            {state === "starting" ? labels.starting : labels.unavailable}
          </p>
        ) : null}
        {torchAvailable ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torch}
            aria-label={torch ? labels.torchOff : labels.torchOn}
            className="absolute end-3 top-3 flex size-14 items-center justify-center rounded-full bg-black/60 text-white"
            data-testid="camera-torch"
          >
            <Icon icon={torch ? IconTorchOff : IconTorch} size={26} />
          </button>
        ) : null}
      </div>

      {multiple && shots.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" data-testid="camera-shots">
          {shots.map((shot, index) => (
            <li key={shot.url} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a page image */}
              <img src={shot.url} alt="" className="rounded-control size-20 object-cover" />
              <button
                type="button"
                aria-label={labels.remove(index + 1)}
                onClick={() => {
                  URL.revokeObjectURL(shot.url);
                  setShots((current) => current.filter((candidate) => candidate !== shot));
                }}
                className="absolute -end-2 -top-2 flex size-12 items-center justify-center"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-black/70 text-white">
                  <Icon icon={IconClose} size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        size="xl"
        block
        iconStart={IconCamera}
        loading={busy}
        disabled={disabled || state !== "live" || full}
        onClick={() => void shoot()}
        data-testid="camera-shutter"
      >
        {label}
      </Button>
      {multiple ? (
        <Button
          size="xl"
          variant="secondary"
          block
          disabled={disabled || shots.length === 0}
          onClick={() => {
            onCapture(shots.map((shot) => shot.file));
            shots.forEach((shot) => URL.revokeObjectURL(shot.url));
            setShots([]);
          }}
          data-testid="camera-done"
        >
          {labels.done(shots.length)}
        </Button>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="camera-file"
        onChange={(event) => {
          void fromFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        variant={state === "unavailable" ? "primary" : "ghost"}
        size="lg"
        block
        iconStart={IconImage}
        disabled={disabled || full}
        onClick={() => fileRef.current?.click()}
      >
        {labels.chooseFile}
      </Button>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
