import { afterEach, describe, expect, it } from "vitest";

import {
  canReceiveServiceRedirect,
  serviceRedirectUri,
} from "../runtime/browser/services/helpers";

function setHostConfig(config: Record<string, unknown> | undefined): void {
  if (config === undefined) {
    delete (globalThis as any).__MEANDER_CONFIG__;
    return;
  }
  (globalThis as any).__MEANDER_CONFIG__ = config;
}

afterEach(() => {
  setHostConfig(undefined);
});

describe("serviceRedirectUri", () => {
  it("serves the callback from the page's own origin on the web", () => {
    setHostConfig(undefined);
    expect(serviceRedirectUri()).toBe(`${window.location.origin}/serviceRedirect`);
  });

  it("honours an origin a provider insists on", () => {
    // Spotify takes a loopback callback only as a literal 127.0.0.1.
    setHostConfig(undefined);
    expect(serviceRedirectUri("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5173/serviceRedirect",
    );
  });

  it("points at the desktop app's own server, which the OS browser can reach", () => {
    // The webview's origin is saucer://embedded in release builds — an address
    // that means nothing to the browser the login runs in.
    setHostConfig({ frontendPort: 9090 });
    expect(serviceRedirectUri("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:9090/serviceRedirect",
    );
  });
});

describe("canReceiveServiceRedirect", () => {
  it("is true on the web and in an app that holds its port", () => {
    setHostConfig(undefined);
    expect(canReceiveServiceRedirect()).toBe(true);

    setHostConfig({ frontendPort: 9090, ownsFrontendPort: true });
    expect(canReceiveServiceRedirect()).toBe(true);
  });

  it("is false once a second instance holds the port", () => {
    // The first instance is the one listening, so the callback completes the
    // login in its window instead of this one.
    setHostConfig({ frontendPort: 9090, ownsFrontendPort: false });
    expect(canReceiveServiceRedirect()).toBe(false);
  });
});
