import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

import HttpClientUI from "../ui/HttpClientUI";

/**
 * Why a request failed, on the remote HTTP Client's panel.
 *
 * A failed request passes nothing on, so the panel is the only place a person
 * sees that it failed — a destination a hosted server refuses, most of all,
 * which otherwise looks exactly like a request that is still to be made.
 */

function service() {
  return {
    uuid: "request",
    serviceId: "http-client",
    serviceName: "Request",
    board: "b",
    app: {
      registerNotificationTarget: vi.fn(),
      unregisterNotificationTarget: vi.fn(),
    },
    configure: vi.fn(async () => {}),
    process: vi.fn(),
    getConfiguration: vi.fn(async () => ({
      url: "http://192.168.178.64:8765/",
      method: "get",
      headers: {},
      body: "",
    })),
    destroy: vi.fn(),
  } as any;
}

const REFUSED =
  "This server does not reach private addresses (192.168.178.64)";

async function renderPanel() {
  const svc = service();
  render(<HttpClientUI service={svc} onServiceAction={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByDisplayValue("http://192.168.178.64:8765/")).toBeTruthy();
  });
  // The frame and the panel each register a target; a notification reaches
  // every one, as the runtime delivers it.
  const targets = (svc.app.registerNotificationTarget as any).mock.calls.map(
    (call: any[]) => call[1],
  );
  return (message: unknown) => targets.forEach((target: any) => target(message));
}

describe("the remote HTTP Client's error", () => {
  it("shows why a request failed", async () => {
    const notify = await renderPanel();
    act(() =>
      notify({
        requesting: false,
        method: "get",
        url: "http://192.168.178.64:8765/",
        status: 0,
        error: REFUSED,
      }),
    );
    expect(screen.getByRole("alert").textContent).toBe(REFUSED);
  });

  it("clears it when a request gets a response", async () => {
    const notify = await renderPanel();
    act(() => notify({ requesting: false, status: 0, error: REFUSED }));
    expect(screen.getByRole("alert")).toBeTruthy();
    act(() => notify({ requesting: false, status: 200, error: "" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps it while the next request is under way", async () => {
    const notify = await renderPanel();
    act(() => notify({ requesting: false, status: 0, error: REFUSED }));
    act(() => notify({ requesting: true, method: "get", url: "http://x/" }));
    expect(screen.getByRole("alert").textContent).toBe(REFUSED);
  });
});
