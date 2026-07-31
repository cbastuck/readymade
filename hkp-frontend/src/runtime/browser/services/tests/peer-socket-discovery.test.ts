import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("hkp-frontend/src/views/playground/common", () => ({
  availableDiscoveryPeerHosts: [
    { host: "peerjs.example.com", port: 443, path: "/", secure: true, discoverable: false },
  ],
}));

vi.mock("hkp-frontend/src/templateVars", () => ({
  resolveTemplateVars: (value: string) => value,
}));

// The live PeerJS connection is irrelevant here and would open a socket.
vi.mock("../PeerConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../PeerConnection")>();
  return {
    ...actual,
    default: class {
      connect() {}
      close() {}
      async sendData() {}
    },
  };
});

import peerSocketModule from "../PeerSocket";

function makeService() {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    getAuthenticatedUser: () => null,
  };
  const descriptor = (peerSocketModule as any).default ?? peerSocketModule;
  return descriptor.create(app, "board", descriptor, "peer-1");
}

describe("PeerSocket peer lookup setting", () => {
  let service: any;

  beforeEach(() => {
    service = makeService();
  });

  it("defaults to looking peers up", () => {
    // Discovery is useful and most servers allow it; switching it off is the
    // deliberate act, not switching it on.
    expect(service.state.peerDiscovery).toBe(true);
  });

  it("can be switched off and back on through configure", () => {
    service.configure({ peerDiscovery: false });
    expect(service.state.peerDiscovery).toBe(false);

    service.configure({ peerDiscovery: true });
    expect(service.state.peerDiscovery).toBe(true);
  });

  it("is untouched by a configure that does not mention it", () => {
    service.configure({ peerDiscovery: false });
    service.configure({ targetPeer: "someone" });
    expect(service.state.peerDiscovery).toBe(false);
  });

  it("coerces a truthy value from board JSON to a boolean", () => {
    service.configure({ peerDiscovery: 0 });
    expect(service.state.peerDiscovery).toBe(false);
  });
});
