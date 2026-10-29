import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectFacebookPage } from "@/features/owner/growth/FacebookPageActions";
import { renderWithIntl } from "@/features/shared/test/intl";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

/** Review L9: a Page access token is masked but never offered to a password manager. */
describe("third-party secret fields (review L9)", () => {
  it("the Facebook Page token opts out of password managers", async () => {
    await renderWithIntl(<ConnectFacebookPage replacing={false} />);
    fireEvent.click(screen.getByTestId("facebook-connect"));
    const token = await screen.findByTestId("facebook-token");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "new-password");
    expect(token).toHaveAttribute("data-1p-ignore", "true");
    expect(token).toHaveAttribute("data-lpignore", "true");
    expect(token).toHaveAttribute("data-bwignore", "true");
    expect(token).toHaveAttribute("spellcheck", "false");
  });
});
