"use client";

/**
 * The last resort when a root layout itself throws. It renders its own `<html>` because no layout is
 * left to provide one, so it carries no i18n and no design system — plain, legible, both languages.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>เกิดข้อผิดพลาด / Something went wrong</h1>
        <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}>
          ลองอีกครั้ง / Try again
        </button>
      </body>
    </html>
  );
}
