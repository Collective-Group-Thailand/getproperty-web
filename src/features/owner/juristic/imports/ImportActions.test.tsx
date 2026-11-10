import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/features/shared/test/intl";

import { ReconcileForm, SheetUpload } from "./ImportActions";

const upload = vi.fn();
vi.mock("../../shared/upload", () => ({
  uploadOwnerFile: (...args: unknown[]) => upload(...args),
  whenScanned: vi.fn(),
}));
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ POST: vi.fn(), DELETE: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const JOB = "1b000000-0000-4000-8000-000000000001";
const BUILDING = "1b000000-0000-4000-8000-000000000002";
const MB = 1024 * 1024;

function fileOf(name: string, bytes: number, type: string): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

beforeEach(() => upload.mockReset());

/** Review W7: a file over the limit was dropped without a word — the replace button and the reconcile evidence. */
describe("import files over the size limit say so (review W7)", () => {
  it("replacing a sheet's file with one over 5 MB shows the limit and uploads nothing", async () => {
    await renderWithIntl(
      <SheetUpload
        jobId={JOB}
        buildingId={BUILDING}
        sheet={"owners" as never}
        file={{ fileName: "owners.csv", rowCount: 10, errorCount: 0, warningCount: 0 } as never}
        canEdit
        label="เจ้าของร่วม"
      />,
    );
    fireEvent.change(screen.getByTestId("file-replace-input"), {
      target: { files: [fileOf("owners.xlsx", 6 * MB, "text/csv")] },
    });
    expect(await screen.findByTestId("file-too-large")).toHaveTextContent("5 MB");
    expect(upload).not.toHaveBeenCalled();
  });

  it("evidence over 10 MB on the reconcile form shows the limit and is not attached", async () => {
    await renderWithIntl(
      <ReconcileForm
        jobId={JOB}
        buildingId={BUILDING}
        reconciliation={
          {
            declaredReceivables: "1000.00",
            explanationRequired: true,
            note: "",
            documentId: null,
          } as never
        }
        readOnly={false}
      />,
    );
    fireEvent.change(screen.getByTestId("reconcile-attach-input"), {
      target: { files: [fileOf("statement.pdf", 11 * MB, "application/pdf")] },
    });
    const input = screen.getByTestId("reconcile-attach-input");
    await vi.waitFor(() => expect(input).toHaveAccessibleDescription(expect.stringContaining("ใหญ่เกิน 10 MB")));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByTestId("reconcile-attachment")).toBeNull();
  });
});
