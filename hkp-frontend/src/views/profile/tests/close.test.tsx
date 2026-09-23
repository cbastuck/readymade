import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Profile from "..";

/**
 * Leaving the account.
 *
 * The account is opened from wherever someone happened to be — a board, the
 * start page — so closing it has to go back there rather than to one fixed
 * place. The exception is the account being the first thing a session showed:
 * back would leave the app, and there is nowhere to return to.
 */

function Where() {
  return <div>at {useLocation().pathname}</div>;
}

function renderAt(entries: string[], index: number) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("closing the account page", () => {
  it("goes back to the view it was opened from", () => {
    renderAt(["/playground/my-board", "/profile"], 1);

    fireEvent.click(screen.getByLabelText("Close"));

    expect(screen.getByText("at /playground/my-board")).toBeTruthy();
  });

  it("goes home when the account is where the session started", () => {
    renderAt(["/profile"], 0);

    fireEvent.click(screen.getByLabelText("Close"));

    expect(screen.getByText("at /")).toBeTruthy();
  });

  it("lets a host say where back is", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Profile onClose={onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Close"));

    expect(onClose).toHaveBeenCalled();
  });
});
