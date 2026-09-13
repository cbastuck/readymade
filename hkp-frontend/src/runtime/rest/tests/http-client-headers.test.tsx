import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import HttpClientUI from "../ui/HttpClientUI";
import preset from "../../../../presets/http-client/elevenlabs-text-to-speech.json";

/**
 * The header names a remote HTTP Client can hold.
 *
 * A header name is open-ended: every API asks for its own — `xi-api-key`,
 * `anthropic-version`, whatever is in its manual. This panel offered a fixed
 * list of common ones, which meant a name outside it could neither be typed nor
 * *shown*: the board held the header, the request sent it, and the panel
 * displayed an empty box with a value beside it.
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

describe("the remote HTTP Client's headers", () => {
  it("shows a header name that is not one of the common ones", async () => {
    render(
      <HttpClientUI service={service(preset.state)} onServiceAction={vi.fn()} />,
    );

    // The preset's own headers: one API-specific name, two common ones.
    await waitFor(() => {
      expect(screen.getByDisplayValue("xi-api-key")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("{{secret.elevenlabs}}")).toBeTruthy();
    expect(screen.getByDisplayValue("content-type")).toBeTruthy();
    expect(screen.getByDisplayValue("accept")).toBeTruthy();
  });

  it("keeps a name the service reports rather than blanking it", async () => {
    const state = {
      url: "https://api.example.com",
      method: "get",
      headers: { "anthropic-version": "2023-06-01" },
      body: "",
    };
    render(<HttpClientUI service={service(state)} onServiceAction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("anthropic-version")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("2023-06-01")).toBeTruthy();
  });
});
