import { describe, expect, it, vi } from "vitest";

// The first discovery host stands in for peerjs.hookitapp.com, which never
// publishes its peer list.
vi.mock("hkp-frontend/src/views/playground/common", () => ({
  availableDiscoveryPeerHosts: [
    {
      host: "peerjs.example.com",
      port: 443,
      path: "/",
      secure: true,
      discoverable: false,
    },
  ],
}));

vi.mock("hkp-frontend/src/templateVars", () => ({
  resolveTemplateVars: (value: string) => value,
}));

import { resolveActivePeerHost } from "../PeerConnection";
import { createBoardCoordinator } from "hkp-frontend/src/core/coordinator";

const base = {
  peerHost: null,
  peerPort: null,
  peerPath: null,
  peerSecure: null,
  __hkpMount: null,
};

describe("peer host discoverability", () => {
  it("carries an opt-out from the descriptor of the default server", () => {
    expect(resolveActivePeerHost(base)?.discoverable).toBe(false);
  });

  it("still follows the descriptor when only the port is overridden", () => {
    // The host is unchanged, so the opt-out still applies — discoverability is
    // a property of the server, not of the port it was reached on.
    expect(
      resolveActivePeerHost({ ...base, peerPort: 9000 })?.discoverable,
    ).toBe(false);
  });

  it("assumes a server the user typed is discoverable", () => {
    expect(
      resolveActivePeerHost({ ...base, peerHost: "peers.mine.example" })
        ?.discoverable,
    ).toBe(true);
  });

  it("assumes a peer server reached through a mount is discoverable", () => {
    // Assumed like any other server without a descriptor to opt out: the
    // client cannot know the policy of a server it was only handed an address
    // for.
    const coordinator = createBoardCoordinator(() => ({
      services: {
        node: [
          {
            uuid: "peer-svc",
            state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc" },
          },
        ],
      },
    }));
    const resolved = resolveActivePeerHost(
      { ...base, __hkpMount: "hkp-mount://node/peer-svc" },
      coordinator,
    );
    expect(resolved).toMatchObject({
      host: "127.0.0.1",
      port: 8080,
      path: "/hosted/abc",
      discoverable: true,
    });
  });
});
