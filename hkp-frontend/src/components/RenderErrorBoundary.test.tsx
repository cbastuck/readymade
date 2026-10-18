import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RenderErrorBoundary from "./RenderErrorBoundary";
import { BOARD_RENDER_FAILURE_EVENT } from "../core/renderFailures";

function Broken() {
  throw new Error("conditions.map is not a function");
}

afterEach(() => vi.restoreAllMocks());

describe("RenderErrorBoundary", () => {
  it("contains a panel failure and reports it to board transactions", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reported = vi.fn();
    window.addEventListener(BOARD_RENDER_FAILURE_EVENT, reported);

    render(
      <RenderErrorBoundary scope="Service Filter">
        <Broken />
      </RenderErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Service Filter could not be displayed",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "conditions.map is not a function",
    );
    expect(reported).toHaveBeenCalledTimes(1);

    window.removeEventListener(BOARD_RENDER_FAILURE_EVENT, reported);
  });

  it("lets the person retry a failed panel", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RenderErrorBoundary scope="Service Filter">
        <Broken />
      </RenderErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry panel" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
