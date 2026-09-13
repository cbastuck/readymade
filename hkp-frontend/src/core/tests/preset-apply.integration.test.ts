import { describe, expect, it } from "vitest";

import BrowserRuntimeScope from "../../runtime/browser/BrowserRuntimeScope";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import browserApi, {
  addService,
  configureService,
  getServiceConfig,
} from "../../runtime/browser/BrowserRuntimeApi";
import { applyPreset, parsePreset } from "../presets";
import { builtInPresetsFor } from "../../presetRegistry";
import type { BoardStateRefs } from "../boardContextTypes";
import type { RuntimeDescriptor, ServiceDescriptor } from "../../types";

/**
 * Applying a preset inside a real runtime, rather than against a mocked api.
 *
 * What is worth testing here is the claim the feature rests on: applying a
 * preset *replaces*. That only means anything against a service that really
 * holds state — a mock accepts any configure call and remembers whatever it was
 * handed, which is exactly the part that must not be assumed.
 */

const runtime: RuntimeDescriptor = {
  id: "rt-preset-1",
  name: "Browser Runtime",
  type: "browser",
};

const asRef = <T,>(current: T) => ({ current });

async function boardWithHttpClient() {
  const registry = await BrowserRegistry.create();
  const scope = new BrowserRuntimeScope(runtime, registry);

  const request = (await addService(
    scope as any,
    { serviceId: "http-client", serviceName: "Request" } as any,
    "request",
  )) as ServiceDescriptor;
  const monitor = (await addService(
    scope as any,
    { serviceId: "hookup.to/service/monitor", serviceName: "Response" } as any,
    "monitor",
  )) as ServiceDescriptor;

  const services = { [runtime.id]: [request, monitor] };
  const refs = {
    runtimesRef: asRef([runtime]),
    servicesRef: asRef(services),
    scopesRef: asRef({ [runtime.id]: scope }),
    propsRef: asRef({ runtimeApis: { browser: browserApi } }),
    setServices: (update: any) => {
      const next =
        typeof update === "function" ? update(services) : update;
      services[runtime.id] = next[runtime.id];
    },
  } as unknown as BoardStateRefs;

  return { scope, refs, services };
}

describe("applying a preset in a browser runtime", () => {
  it("leaves nothing of the configuration it replaced", async () => {
    const { scope, refs } = await boardWithHttpClient();

    // A service in the middle of being used for something else entirely.
    await configureService(scope as any, { uuid: "request" }, {
      url: "https://api.github.com",
      path: "/zen",
      method: "get",
      headers: { "x-stale": "left over from the last API" },
    });

    const preset = builtInPresetsFor("http-client").find(
      (entry) => entry.id === "elevenlabs-text-to-speech",
    )!;
    expect(preset).toBeDefined();

    await applyPreset(preset, runtime, { uuid: "request" }, refs);

    const state = await getServiceConfig(scope as any, { uuid: "request" });
    expect(state.url).toBe("https://api.elevenlabs.io");
    expect(state.method).toBe("post");
    // The point of replace: the header from the previous API is gone, rather
    // than riding along on every ElevenLabs request.
    expect(state.headers["x-stale"]).toBeUndefined();
    expect(state.headers["xi-api-key"]).toBe("{{secret.elevenlabs}}");
  });

  it("keeps the uuid, the position and the pipeline around it", async () => {
    const { scope, refs, services } = await boardWithHttpClient();

    const preset = builtInPresetsFor("http-client")[0];
    const { service } = await applyPreset(
      preset,
      runtime,
      { uuid: "request" },
      refs,
    );

    // Facade widgets and mount addresses are keyed by uuid, so an applied
    // preset must be an edit of this service rather than a different one.
    expect(service.uuid).toBe("request");
    expect(scope.findServiceInstance("request")[0]).toBeDefined();
    expect(services[runtime.id].map((svc) => svc.uuid)).toEqual([
      "request",
      "monitor",
    ]);
    // The runtime's own order, which is the pipeline's wiring.
    expect(scope.serviceInstances.map((svc: any) => svc.uuid)).toEqual([
      "request",
      "monitor",
    ]);
    // The preset names the instance.
    expect(service.serviceName).toBe(preset.serviceName);
  });

  it("hands the panel a new instance, already configured", async () => {
    // How a panel learns anything: it initialises once per service *object*,
    // reading the configuration the first time it sees one and listening for
    // notifications after that. So the instance the board publishes must be a
    // new object (or no panel re-reads) and must already carry the preset (or
    // the panel reads defaults and never hears the rest).
    const { scope, refs } = await boardWithHttpClient();
    const before = scope.findServiceInstance("request")[0];

    const preset = builtInPresetsFor("http-client").find(
      (entry) => entry.id === "elevenlabs-text-to-speech",
    )!;
    await applyPreset(preset, runtime, { uuid: "request" }, refs);

    const after = scope.findServiceInstance("request")[0];
    expect(after).not.toBe(before);
    expect((await after!.getConfiguration!()).url).toBe(
      "https://api.elevenlabs.io",
    );
  });

  it("carries a published mount address across the recreation", async () => {
    const { scope, refs } = await boardWithHttpClient();

    await configureService(scope as any, { uuid: "request" }, {
      __hkpMount: "http://127.0.0.1:8080/hosted/abc",
    });

    const preset = parsePreset({
      preset: "v1",
      id: "plain",
      name: "Plain",
      serviceId: "http-client",
      state: { url: "https://example.com", method: "get" },
    });
    await applyPreset(preset, runtime, { uuid: "request" }, refs);

    const state = await getServiceConfig(scope as any, { uuid: "request" });
    expect(state.__hkpMount).toBe("http://127.0.0.1:8080/hosted/abc");
  });
});
