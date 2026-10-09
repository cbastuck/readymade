import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RuntimeUnreachableDialog from "./RuntimeUnreachableDialog";
import {
  requestFromServer,
  resetRuntimeReach,
} from "../core/runtimeReach";

const server = { url: "http://127.0.0.1:8080", runtimeName: "Node" };
const noAnswer = () => Promise.reject(new TypeError("Failed to fetch"));

afterEach(() => {
  resetRuntimeReach();
  vi.restoreAllMocks();
});

describe("RuntimeUnreachableDialog", () => {
  it("shows nothing while every server answers", () => {
    render(<RuntimeUnreachableDialog />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the server and this page, and both things that could be wrong", async () => {
    render(<RuntimeUnreachableDialog />);

    void requestFromServer(server, noAnswer).catch(() => {});

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("http://127.0.0.1:8080");
    expect(dialog.textContent).toContain("Node");
    expect(dialog.textContent).toContain("If it is not running");
    expect(dialog.textContent).toContain("If it is running");
    // What to type at the server's end, with this page's origin in it.
    expect(dialog.textContent).toContain(
      `ALLOWED_ORIGINS=${window.location.origin}`,
    );
  });

  it("stays open and says so while the server still gives no answer", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(noAnswer);
    render(<RuntimeUnreachableDialog />);
    const request = vi.fn(noAnswer);
    void requestFromServer(server, request).catch(() => {});

    fireEvent.click(await screen.findByText("Check again"));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Still no answer",
      ),
    );
    // Nothing was retried: the board waits until the check passes.
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("closes and lets the request through once the server answers", async () => {
    let up = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      up
        ? Promise.resolve(new Response("{}", { status: 200 }))
        : noAnswer(),
    );
    render(<RuntimeUnreachableDialog />);
    const waiting = requestFromServer(server, () =>
      up ? Promise.resolve(new Response("{}", { status: 200 })) : noAnswer(),
    );

    const check = await screen.findByText("Check again");
    up = true;
    fireEvent.click(check);

    expect((await waiting).status).toBe(200);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("lets the board load without the runtime when told to", async () => {
    render(<RuntimeUnreachableDialog />);
    const waiting = requestFromServer(server, noAnswer);

    fireEvent.click(await screen.findByText("Continue without it"));

    await expect(waiting).rejects.toThrow("Failed to fetch");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
