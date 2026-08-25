import { describe, it, expect, afterEach } from "vitest";

import {
  getTemplateVarMap,
  resolveTemplateVars,
} from "hkp-frontend/src/templateVars";

// The host injects its LAN addresses as a global; a plain browser has none.
function setHostConfig(config: Record<string, any> | undefined) {
  if (config === undefined) {
    delete (globalThis as any).__MEANDER_CONFIG__;
  } else {
    (globalThis as any).__MEANDER_CONFIG__ = config;
  }
}

afterEach(() => {
  setHostConfig(undefined);
});

describe("resolveTemplateVars", () => {
  it("uses the host's LAN address when it is injected", () => {
    setHostConfig({ lanIp: "192.168.1.5", frontendPort: 9090, apiPort: 8887 });
    expect(resolveTemplateVars("HKP_WEBAPP_URL/playground/x")).toBe(
      "http://192.168.1.5:9090/playground/x",
    );
  });

  it("falls back to the webapp's own origin without host config", () => {
    expect(resolveTemplateVars("HKP_WEBAPP_URL/playground/x")).toBe(
      `${window.location.origin}/playground/x`,
    );
  });

  it("leaves the runtime variables in place without host config", () => {
    expect(resolveTemplateVars("http://HKP_RUNTIME_HOST:8887")).toBe(
      "http://HKP_RUNTIME_HOST:8887",
    );
  });

  it("keeps the host var map empty without host config", () => {
    expect(getTemplateVarMap()).toEqual({});
  });
});
