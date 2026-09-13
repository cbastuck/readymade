import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import HttpClientUI from "../ui/HttpClientUI";
import preset from "../../../../presets/http-client/opencode-zen-chat-completions.json";

/**
 * Which target the panel offers a path for.
 *
 * `path` is the sub-path of a mount and of nothing else: a mount's address is
 * assigned by a runtime and resolved by the coordinator, so it is not the
 * panel's to type and a sub-path of it has nowhere else to go. A typed URL has
 * somewhere — itself — so offering a second field for one would be two places
 * to write the same thing, and the service ignores it there.
 */

function service(state: Record<string, any>) {
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
    // The remote shape: state arrives from a fetch, after the first render.
    getConfiguration: vi.fn(async () => state),
    destroy: vi.fn(),
  } as any;
}

describe("the remote HTTP Client's target", () => {
  it("shows a preset's whole URL, and offers no path beside it", async () => {
    render(
      <HttpClientUI service={service(preset.state)} onServiceAction={vi.fn()} />,
    );

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("https://opencode.ai/zen/v1/chat/completions"),
      ).toBeTruthy();
    });
    expect(screen.queryByText("Path")).toBeNull();
  });

  it("offers a path once the target is a mount", async () => {
    const state = {
      url: "hkp-mount://endpoint-node/echo-server",
      path: "/hello",
      method: "post",
      headers: {},
      body: "",
    };
    render(<HttpClientUI service={service(state)} onServiceAction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("/hello")).toBeTruthy();
    });
  });

  it("keeps the URL while a request reports the address it called", async () => {
    const state = {
      url: "https://api.example.com/v1/messages",
      method: "post",
      headers: {},
      body: "",
    };
    const svc = service(state);
    render(<HttpClientUI service={svc} onServiceAction={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("https://api.example.com/v1/messages"),
      ).toBeTruthy();
    });

    // The progress notification says the address with the parameters on it,
    // which is not what the field holds.
    const notify = (svc.app.registerNotificationTarget as any).mock.calls[0][1];
    notify({
      requesting: true,
      method: "post",
      url: "https://api.example.com/v1/messages?page=2",
    });

    expect(
      screen.getByDisplayValue("https://api.example.com/v1/messages"),
    ).toBeTruthy();
  });
});
