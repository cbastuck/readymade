import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";

import Remotes from "..";
import { RuntimeClass } from "hkp-frontend/src/types";

/**
 * Opening a remote runtime from the start page's Remotes source.
 *
 * The view attaches — GET /runtimes plus the socket the runtime publishes — and
 * renders that runtime's panels live. A Monitor is the case that proves it: its
 * output is no part of its state, so it renders nothing at all unless the
 * server's notifications arrive.
 */

const remote: RuntimeClass = {
  type: "rest",
  name: "Local",
  url: "http://remote.test:8080",
};

const runtimesResponse = {
  runtimes: [
    {
      id: "node",
      name: "Node",
      outputUrl: "ws://remote.test:8080/node",
      services: [
        { uuid: "timer-1", serviceId: "timer", serviceName: "Timer", state: {} },
        {
          uuid: "mon-1",
          serviceId: "monitor",
          serviceName: "Monitor",
          state: { logToConsole: true },
        },
      ],
    },
  ],
  registry: [
    { serviceId: "monitor", serviceName: "Monitor" },
    { serviceId: "timer", serviceName: "Timer" },
  ],
};

const sockets: FakeSocket[] = [];

/** Connects on a turn of the event loop, as a real one does — closing before
 *  that is the case the deferred close in RuntimeRestScope exists for. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(this);
    setTimeout(() => {
      if (this.readyState !== FakeSocket.CONNECTING) {
        return;
      }
      this.readyState = FakeSocket.OPEN;
      this.onopen?.();
    }, 0);
  }
  send(_data: string) {}
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  /** What a runtime sends its watchers: the older JSON notification form. */
  notify(instanceId: string, value: unknown) {
    this.onmessage?.({
      data: JSON.stringify({
        type: "notification",
        instanceId,
        value: JSON.stringify(value),
      }),
    });
  }
}

describe("a remote runtime opened from the start page", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/runtimes")) {
          return new Response(JSON.stringify(runtimesResponse), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  it("renders the runtime's panels and what its services report", async () => {
    render(
      <MemoryRouter>
        <Remotes remotes={[remote]} remoteName="Local" runtimeId="node" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Monitor/)).toBeTruthy());
    // The socket the runtime published, not one this view invented.
    expect(sockets.map((s) => s.url)).toContain("ws://remote.test:8080/node");

    sockets[0].notify("mon-1", { triggerCount: 7 });

    await waitFor(() =>
      expect(screen.getByDisplayValue(/triggerCount/)).toBeTruthy(),
    );
  });

  it("is still connected after a mount, unmount and mount", async () => {
    // React's development double-invoke does exactly this on every mount. Each
    // attach opens sockets, so an attach that is thrown away has to take its
    // own with it — and the one that survives has to be the one the panels are
    // wired to, or the board renders against sockets that are already closed.
    render(
      <StrictMode>
        <MemoryRouter>
          <Remotes remotes={[remote]} remoteName="Local" runtimeId="node" />
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText(/Monitor/)).toBeTruthy());
    const live = await waitFor(() => {
      const open = sockets.filter((s) => s.readyState === FakeSocket.OPEN);
      expect(open.length).toBeGreaterThan(0);
      return open;
    });

    live[live.length - 1].notify("mon-1", { triggerCount: 3 });

    await waitFor(() =>
      expect(screen.getByDisplayValue(/triggerCount/)).toBeTruthy(),
    );
  });

  it("says so when the server is not one this host knows", async () => {
    render(
      <MemoryRouter>
        <Remotes remotes={[remote]} remoteName="Elsewhere" />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText(/No remote server named/)).toBeTruthy(),
    );
    expect(sockets).toHaveLength(0);
  });
});
