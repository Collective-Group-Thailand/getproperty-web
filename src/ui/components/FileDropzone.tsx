"use client";

import { useId, useRef, useState } from "react";

import { Icon } from "../icons";
import { IconUpload } from "../icons/glyphs/upload";
import { cn } from "../lib/cn";

export interface FileDropzoneProps {
  /** Visible label ("แนบรูปหลักฐาน"). */
  label: string;
  /** What is accepted and how big, in words ("JPG, PNG หรือ PDF ไม่เกิน 10 MB"). */
  hint?: string;
  /** `accept` of the file input (`image/*,application/pdf`, `.xlsx`). */
  accept?: string;
  multiple?: boolean;
  /** Bytes; a larger file is refused before upload with `tooLargeText`. */
  maxBytes?: number;
  tooLargeText?: string;
  /** "Choose a file" — the button text of the alternative to dragging. */
  chooseText: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  "data-testid"?: string;
}

/**
 * Drop files here or choose them (design-system.md §3 "FileDropzone"). Dragging is never the only way
 * (WCAG 2.5.7): the whole zone is a labelled file input reachable by keyboard. Files are handed to the
 * caller as they are; uploading (presign → PUT → complete) is the caller's job.
 */
export function FileDropzone({
  label,
  hint,
  accept,
  multiple = false,
  maxBytes,
  tooLargeText,
  chooseText,
  disabled = false,
  onFiles,
  className,
  "data-testid": testId,
}: FileDropzoneProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const tooLarge = maxBytes ? files.filter((file) => file.size > maxBytes) : [];
    setRefused(tooLarge.length > 0 ? (tooLargeText ?? null) : null);
    const ok = files.filter((file) => !tooLarge.includes(file));
    if (ok.length > 0) onFiles(multiple ? ok : ok.slice(0, 1));
  };

  return (
    <div className={cn("flex flex-col gap-1", className)} data-testid={testId}>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (!disabled) take(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-card border-border-strong bg-bg-subtle flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-4 text-center",
          "focus-within:ring-focus-ring focus-within:ring-2",
          over && "border-primary bg-primary-subtle",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <Icon icon={IconUpload} size={24} className="text-muted" />
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-muted text-sm">{hint}</span> : null}
        <span className="text-primary text-sm font-medium underline">{chooseText}</span>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {refused ? (
        <p className="text-danger text-sm font-medium" role="alert">
          {refused}
        </p>
      ) : null}
    </div>
  );
}
