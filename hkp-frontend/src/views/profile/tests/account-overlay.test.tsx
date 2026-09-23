import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Opening the account from a board's toolbar.
 *
 * A board is live state — runtimes running, edits held nowhere but in the
 * view — so the account has to appear over it. The test that matters is not
 * that a dialog opened but that the board underneath is still mounted: it was
 * a view swap that used to throw the work away.
 */

vi.mock("hkp-frontend/src/auth/useCloudLogin", () => ({
  useCloudLogin: () => vi.fn(),
  useCanCloudLogin: () => true,
}));
vi.mock("hkp-frontend/src/auth/useCloudLogout", () => ({
  useCloudLogout: () => vi.fn(),
}));
vi.mock("hkp-frontend/src/AppContext", () => ({
  useAppContext: () => ({
    user: { username: "ada", userId: "auth0|1", idToken: "" },
  }),
}));

const { default: AccountAvatar } = await import(
  "hkp-frontend/src/components/Toolbar/AccountAvatar"
);

function Board() {
  return (
    <>
      <div>board canvas</div>
      <AccountAvatar />
    </>
  );
}

describe("the account from a board's toolbar", () => {
  it("opens over the board, leaving it mounted", () => {
    render(
      <MemoryRouter initialEntries={["/playground/my-board"]}>
        <Routes>
          <Route path="/playground/:board" element={<Board />} />
          <Route path="/profile" element={<div>account took the screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Account (ada)"));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("board canvas")).toBeTruthy();
    expect(screen.queryByText("account took the screen")).toBeNull();
  });

  it("stays open when the board behind it is clicked", async () => {
    render(
      <MemoryRouter initialEntries={["/playground/my-board"]}>
        <Routes>
          <Route path="/playground/:board" element={<Board />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Account (ada)"));
    // Radix arms its outside-dismiss listener a tick after the layer mounts,
    // so a press fired before that would prove nothing.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    // The account holds an unsaved form; a stray click on the board behind is
    // not a decision to discard it.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("leaves the board showing once the account is closed", () => {
    render(
      <MemoryRouter initialEntries={["/playground/my-board"]}>
        <Routes>
          <Route path="/playground/:board" element={<Board />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Account (ada)"));
    fireEvent.click(screen.getByLabelText("close-dialog-button"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("board canvas")).toBeTruthy();
  });
});
