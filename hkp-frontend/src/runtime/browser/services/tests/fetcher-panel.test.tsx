import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import FetcherUI from "../FetcherUI";

function service() {
  return {
    uuid: "request", serviceId: "hookup.to/service/fetcher", serviceName: "Request", board: "b",
    app: { registerNotificationTarget: vi.fn(), unregisterNotificationTarget: vi.fn() },
    configure: vi.fn(async () => {}), process: vi.fn(), destroy: vi.fn(),
    getConfiguration: vi.fn(async () => ({
      url: null, method: "GET", headers: {}, body: null, bodyExpression: null, bodyFormat: "text",
    })),
  } as any;
}

describe("the Fetcher panel's empty fields", () => {
  it("keeps null service values controlled, and clears a previously configured URL", async () => {
    const errors = vi.spyOn(console, "error");
    const svc = service();
    render(<FetcherUI service={svc} onServiceAction={vi.fn()} />);
    await waitFor(() => expect(svc.getConfiguration).toHaveBeenCalled());
    const notify = (state: Record<string, unknown>) => {
      for (const [, target] of svc.app.registerNotificationTarget.mock.calls) target(state);
    };
    await act(async () => notify({ url: "https://api.example.test", body: "hello", bodyExpression: "params" }));
    expect(screen.getByDisplayValue("https://api.example.test")).toBeTruthy();
    // A partial state update must not clear a configured field.
    await act(async () => notify({ method: "POST" }));
    expect(screen.getByDisplayValue("https://api.example.test")).toBeTruthy();
    // Null explicitly clears the service value; the UI displays an empty string.
    await act(async () => notify({ url: null, body: null, bodyExpression: null }));
    expect(screen.queryByDisplayValue("https://api.example.test")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
});
