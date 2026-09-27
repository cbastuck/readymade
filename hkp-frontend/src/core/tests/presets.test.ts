import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  applyPreset,
  attachPresetStorage,
  isUsableAsBlock,
  loadPresetsFromUrl,
  parseBlockDefinition,
  PresetStorage,
  PresetStoredFile,
  updatePresetFromOrigin,
  parsePreset,
  presetState,
  parsePresetFile,
  presetFetchUrl,
  presetFromService,
  presetSecrets,
  removeSavedPreset,
  savePreset,
  savedPresets,
  subscribePresets,
} from "../presets";
import { setSecretStore } from "../secrets";
import { builtInPresets } from "../../presetRegistry";
import type { BoardStateRefs } from "../boardContextTypes";
import type { RuntimeDescriptor, ServiceDescriptor } from "../../types";

const asRef = <T,>(current: T) => ({ current });

const RUNTIME: RuntimeDescriptor = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const PRESET = {
  preset: "v1",
  id: "elevenlabs",
  name: "ElevenLabs",
  serviceId: "http-client",
  serviceName: "ElevenLabs TTS",
  state: {
    url: "https://api.elevenlabs.io",
    path: "/v1/text-to-speech/voice",
    method: "post",
    headers: { "xi-api-key": "{{secret.elevenlabs}}" },
  },
};

/**
 * A board with one configured service on a REST runtime, and an api that
 * records the calls applyPreset makes rather than talking to a runtime.
 */
function makeRefs(state: Record<string, any>) {
  const calls: string[] = [];

  const existing: ServiceDescriptor = {
    uuid: "request",
    serviceId: "http-client",
    serviceName: "Request",
  } as ServiceDescriptor;
  const other: ServiceDescriptor = {
    uuid: "monitor",
    serviceId: "monitor",
    serviceName: "Response",
  } as ServiceDescriptor;

  const api = {
    getServiceConfig: vi.fn(async () => state),
    removeService: vi.fn(async () => {
      calls.push("removeService");
      return null;
    }),
    addService: vi.fn(
      async (_scope: any, service: any, instanceId?: string) => {
        calls.push("addService");
        // A runtime builds a service from its own registry and answers with the
        // name it keeps, which is not necessarily the one that was asked for.
        return {
          ...service,
          serviceName: "HTTP Client",
          uuid: instanceId,
        } as ServiceDescriptor;
      },
    ),
    rearrangeServices: vi.fn(async (_scope: any, list: ServiceDescriptor[]) => {
      calls.push("rearrangeServices");
      return list.map((svc) => ({ ...svc, serviceName: "HTTP Client" }));
    }),
    configureService: vi.fn(async () => {
      calls.push("configureService");
      return {};
    }),
  };

  const services = { node: [existing, other] };
  const setServices = vi.fn(() => calls.push("setServices"));

  const refs = {
    runtimesRef: asRef([RUNTIME]),
    servicesRef: asRef(services),
    scopesRef: asRef({ node: { descriptor: RUNTIME } }),
    propsRef: asRef({ runtimeApis: { rest: api } }),
    setServices,
  } as unknown as BoardStateRefs;

  return { refs, api, setServices, existing, calls };
}

describe("preset format", () => {
  it("rejects anything that is not a preset, saying what is wrong", () => {
    expect(() => parsePreset({})).toThrow(/no "preset" field/);
    expect(() => parsePreset({ preset: "v2" })).toThrow(/unknown format "v2"/);
    expect(() => parsePreset({ preset: "v1", name: "x" })).toThrow(
      /"serviceId" is missing/,
    );
    expect(() =>
      parsePreset({ preset: "v1", name: "x", serviceId: "http-client" }),
    ).toThrow(/"state" is missing/);
    expect(() => parsePresetFile("{nope")).toThrow(/invalid JSON/);
  });

  it("drops board machinery from the state it carries", () => {
    // An address belongs to the board it was published on; a preset that
    // carried one would point a service somewhere it has never been.
    const preset = parsePreset({
      ...PRESET,
      state: { ...PRESET.state, __hkpMount: "http://host:8080/hosted/abc" },
    });
    expect(preset.state.__hkpMount).toBeUndefined();
    expect(preset.state.url).toBe("https://api.elevenlabs.io");
  });

  it("reads a file holding several presets", () => {
    const presets = parsePresetFile(
      JSON.stringify({ presets: [PRESET, { ...PRESET, id: "second" }] }),
    );
    expect(presets.map((p) => p.id)).toEqual(["elevenlabs", "second"]);
  });

  it("derives an id from the name when a file gives none", () => {
    const { id, ...rest } = PRESET;
    expect(parsePreset({ ...rest, name: "ElevenLabs — TTS" }).id).toBe(
      "elevenlabs-tts",
    );
  });

  it("names the secrets its state refers to", () => {
    expect(presetSecrets(parsePreset(PRESET))).toEqual(["elevenlabs"]);
  });

  it("fetches a GitHub page as the file behind it", () => {
    expect(
      presetFetchUrl("https://github.com/o/r/blob/main/presets/x.json"),
    ).toBe("https://raw.githubusercontent.com/o/r/main/presets/x.json");
    expect(presetFetchUrl("https://example.com/x.json")).toBe(
      "https://example.com/x.json",
    );
  });
});

describe("presets saved on this device", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves, replaces by id, and forgets", () => {
    savePreset(parsePreset(PRESET));
    savePreset(parsePreset({ ...PRESET, name: "ElevenLabs, renamed" }));
    expect(savedPresets()).toHaveLength(1);
    expect(savedPresets()[0].name).toBe("ElevenLabs, renamed");

    removeSavedPreset("http-client", "elevenlabs");
    expect(savedPresets()).toHaveLength(0);
  });

  it("skips a stored entry it cannot read rather than losing the list", () => {
    window.localStorage.setItem(
      "hkp-presets",
      JSON.stringify([{ preset: "v0", junk: true }, PRESET]),
    );
    expect(savedPresets().map((p) => p.id)).toEqual(["elevenlabs"]);
  });
});

describe("making a preset from a service", () => {
  it("keeps the configuration and leaves board machinery behind", () => {
    const preset = presetFromService(
      { uuid: "request", serviceId: "http-client", serviceName: "Request" } as ServiceDescriptor,
      {
        url: "https://api.example.com",
        headers: { authorization: "Bearer {{secret.demo}}" },
        __hkpMount: "http://host:8080/hosted/abc",
      },
      "Example API",
    );
    expect(preset.id).toBe("example-api");
    // Named after the preset, so an instance created from it says what it is
    // rather than inheriting the name of the service it was captured from.
    expect(preset.serviceName).toBe("Example API");
    expect(preset.serviceId).toBe("http-client");
    expect(preset.state.__hkpMount).toBeUndefined();
    // The reference, not a value: nothing ever resolved one into service state.
    expect(preset.state.headers.authorization).toBe("Bearer {{secret.demo}}");
  });
});

describe("parameters", () => {
  const withParams = parsePreset({
    preset: "v1",
    name: "Beep",
    serviceId: "sound",
    params: { volume: 0.5, note: "C" },
    state: { volume: "{{param.volume}}", label: "Note {{param.note}}" },
  });

  it("are substituted with their defaults when a preset is applied", () => {
    expect(presetState(withParams)).toEqual({ volume: 0.5, label: "Note C" });
  });

  it("must be an object", () => {
    expect(() =>
      parsePreset({ preset: "v1", name: "X", serviceId: "s", state: {}, params: [] }),
    ).toThrow(/"params" is not an object/);
  });
});

describe("block definitions", () => {
  it("are presets without the format marker", () => {
    const definition = parseBlockDefinition({
      name: "Note",
      serviceId: "sub-service",
      params: { beats: 0.5 },
      state: { pipeline: [], __hkpMount: "http://x/hosted/1" },
    });
    expect(definition).toMatchObject({ id: "note", name: "Note", params: { beats: 0.5 } });
    // Like a preset, a definition carries nothing bound to a board.
    expect(definition.state).toEqual({ pipeline: [] });
  });

  it("say what is wrong with one that is not", () => {
    expect(() => parseBlockDefinition({ name: "Note", state: {} })).toThrow(
      'Not a block: "serviceId" is missing',
    );
  });

  it("are sub-services, under either spelling", () => {
    for (const serviceId of ["sub-service", "hookup.to/service/sub-service"]) {
      expect(
        parseBlockDefinition({ name: "Note", serviceId, state: { pipeline: [] } }).serviceId,
      ).toBe(serviceId);
    }
  });

  it("refuse any other service", () => {
    expect(() =>
      parseBlockDefinition({
        name: "Hit",
        serviceId: "hookup.to/service/sound",
        params: { trigger: "kick" },
        state: { trigger: "{{param.trigger}}" },
      }),
    ).toThrow('Not a block: "serviceId" must name a sub-service');
  });

  it("refuse a sub-service without a pipeline", () => {
    expect(() =>
      parseBlockDefinition({ name: "Note", serviceId: "sub-service", state: { pipeline: "x" } }),
    ).toThrow('Not a block: "state.pipeline" is missing or not an array');
  });
});

describe("applying a preset", () => {
  it("recreates the instance in place and configures it from the preset", async () => {
    const { refs, api, setServices, existing } = makeRefs({
      url: "https://old.example.com",
      headers: { "x-stale": "left over" },
    });

    const result = await applyPreset(
      parsePreset(PRESET),
      RUNTIME,
      { uuid: "request" },
      refs,
    );

    // Replace, not merge: the old instance is gone before the new one exists,
    // so nothing it held can survive into the configuration.
    expect(api.removeService).toHaveBeenCalledTimes(1);
    expect(api.addService).toHaveBeenCalledTimes(1);

    // Same uuid — facade widgets and mount addresses are keyed by it.
    expect(api.addService.mock.calls[0][2]).toBe(existing.uuid);
    expect(result.service.uuid).toBe("request");
    // The preset names the instance.
    expect(api.addService.mock.calls[0][1].serviceName).toBe("ElevenLabs TTS");
    // A class, not the old descriptor: no stale state rides into the create.
    expect(api.addService.mock.calls[0][1].state).toBeUndefined();

    const configured = api.configureService.mock.calls[0][2];
    expect(configured.url).toBe("https://api.elevenlabs.io");
    expect(configured.headers).toEqual({
      "xi-api-key": "{{secret.elevenlabs}}",
    });
    expect(configured["x-stale"]).toBeUndefined();

    // Put back where it was rather than at the end of the pipeline.
    const reordered = api.rearrangeServices.mock.calls[0][1];
    expect(reordered.map((svc: ServiceDescriptor) => svc.uuid)).toEqual([
      "request",
      "monitor",
    ]);
    expect(setServices).toHaveBeenCalled();

    expect(result.secrets).toEqual(["elevenlabs"]);
  });

  it("configures the new instance before the board is told about it", async () => {
    // A panel initialises itself once per service object: it reads the
    // configuration when it first sees one, then only listens for
    // notifications. Published first, it would meet the instance between
    // creation and configuration, show the defaults, and never hear the
    // configure that followed — the preset applied, the panel saying otherwise.
    const { refs, calls } = makeRefs({});

    await applyPreset(parsePreset(PRESET), RUNTIME, { uuid: "request" }, refs);

    expect(calls.indexOf("configureService")).toBeLessThan(
      calls.indexOf("setServices"),
    );
    expect(calls).toEqual([
      "removeService",
      "addService",
      "configureService",
      "setServices",
      "rearrangeServices",
      "setServices",
    ]);
  });

  it("keeps the preset's name for the instance, over the runtime's own", async () => {
    // Both the create and the rearrange answer with the name the runtime keeps
    // for that service id, which is not the one the preset asked for.
    const { refs, setServices } = makeRefs({});

    const result = await applyPreset(
      parsePreset(PRESET),
      RUNTIME,
      { uuid: "request" },
      refs,
    );

    expect(result.service.serviceName).toBe("ElevenLabs TTS");
    const published = setServices.mock.calls.at(-1)![0];
    const list = typeof published === "function"
      ? published({ node: [] }).node
      : published.node;
    expect(list.find((svc: ServiceDescriptor) => svc.uuid === "request").serviceName).toBe(
      "ElevenLabs TTS",
    );
  });

  it("carries board machinery across the recreation", async () => {
    // __hkpMount is an address a coordinator published onto this instance. A
    // preset neither sets it nor clears it, and losing it would leave a
    // consumer dialling nothing until the coordinator happened to say it again.
    const { refs, api } = makeRefs({
      __hkpMount: "http://host:8080/hosted/abc",
      url: "https://old.example.com",
    });

    await applyPreset(parsePreset(PRESET), RUNTIME, { uuid: "request" }, refs);

    expect(api.configureService.mock.calls[0][2].__hkpMount).toBe(
      "http://host:8080/hosted/abc",
    );
  });

  it("applies across the legacy id of the same service", async () => {
    // `hookup.to/service/…` is an alias that stays, so a preset authored on one
    // runtime's spelling of a service applies on the other's.
    const { refs, api } = makeRefs({});
    const services = refs.servicesRef.current!.node;
    services[0] = { ...services[0], serviceId: "hookup.to/service/http-client" };

    await applyPreset(parsePreset(PRESET), RUNTIME, { uuid: "request" }, refs);

    expect(api.configureService).toHaveBeenCalled();
    // Created under the id the board holds, not the preset's spelling of it.
    expect(api.addService.mock.calls[0][1].serviceId).toBe(
      "hookup.to/service/http-client",
    );
  });

  it("refuses a preset written for a different service", async () => {
    const { refs, api } = makeRefs({});
    await expect(
      applyPreset(
        parsePreset({ ...PRESET, serviceId: "imap-email" }),
        RUNTIME,
        { uuid: "request" },
        refs,
      ),
    ).rejects.toThrow(/configures imap-email, not http-client/);
    // Refused before anything was torn down.
    expect(api.removeService).not.toHaveBeenCalled();
  });

  it("reports a secret the device cannot supply without refusing to apply", async () => {
    setSecretStore({ get: () => null, list: () => [] });
    const { refs, api } = makeRefs({});

    const result = await applyPreset(
      parsePreset(PRESET),
      RUNTIME,
      { uuid: "request" },
      refs,
    );

    expect(result.secrets).toEqual(["elevenlabs"]);
    expect(api.configureService).toHaveBeenCalled();
    setSecretStore(null);
  });
});

/** A host's preset folder, kept in memory. */
function memoryStorage(initial: PresetStoredFile[] = []) {
  const files = new Map(initial.map(({ file, source }) => [file, source]));
  const storage: PresetStorage = {
    list: vi.fn(async () => [...files].map(([file, source]) => ({ file, source }))),
    write: vi.fn(async (file: string, source: string) => {
      files.set(file, source);
    }),
    remove: vi.fn(async (file: string) => {
      files.delete(file);
    }),
  };
  return { storage, files };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("presets kept by the host", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(async () => {
    await attachPresetStorage(null);
    window.localStorage.clear();
  });

  it("reads every preset in the host's files, several to a file among them", async () => {
    const { storage } = memoryStorage([
      { file: "one.json", source: JSON.stringify(PRESET) },
      {
        file: "two.json",
        source: JSON.stringify({ presets: [{ ...PRESET, id: "a" }, { ...PRESET, id: "b" }] }),
      },
      { file: "junk.json", source: "{ not json" },
    ]);
    await attachPresetStorage(storage);
    expect(savedPresets().map((p) => p.id).sort()).toEqual(["a", "b", "elevenlabs"]);
  });

  it("writes a saved preset as a file of its own, and deletes it when forgotten", async () => {
    const { storage, files } = memoryStorage();
    await attachPresetStorage(storage);
    savePreset(parsePreset(PRESET));
    await flush();
    expect([...files.keys()]).toEqual(["http-client--elevenlabs.json"]);
    expect(JSON.parse(files.get("http-client--elevenlabs.json")!).id).toBe("elevenlabs");

    removeSavedPreset("http-client", "elevenlabs");
    await flush();
    expect(files.size).toBe(0);
    expect(savedPresets()).toEqual([]);
  });

  it("rewrites a file holding several presets rather than splitting it", async () => {
    const { storage, files } = memoryStorage([
      {
        file: "pair.json",
        source: JSON.stringify({ presets: [{ ...PRESET, id: "a" }, { ...PRESET, id: "b" }] }),
      },
    ]);
    await attachPresetStorage(storage);
    savePreset({ ...parsePreset({ ...PRESET, id: "a" }), tags: ["Speech"] });
    removeSavedPreset("http-client", "b");
    await flush();
    expect([...files.keys()]).toEqual(["pair.json"]);
    const kept = JSON.parse(files.get("pair.json")!);
    expect(kept.id).toBe("a");
    expect(kept.tags).toEqual(["Speech"]);
  });

  it("moves what local storage held into the host's store, once", async () => {
    savePreset(parsePreset(PRESET));
    const { storage, files } = memoryStorage();
    await attachPresetStorage(storage);
    expect([...files.keys()]).toEqual(["http-client--elevenlabs.json"]);
    expect(window.localStorage.getItem("hkp-presets")).toBeNull();
    expect(savedPresets().map((p) => p.id)).toEqual(["elevenlabs"]);
  });

  it("keeps presets in local storage when the host cannot list its store", async () => {
    savePreset(parsePreset(PRESET));
    await attachPresetStorage({
      list: async () => {
        throw new Error("no such route");
      },
      write: vi.fn(),
      remove: vi.fn(),
    });
    expect(savedPresets().map((p) => p.id)).toEqual(["elevenlabs"]);
    expect(window.localStorage.getItem("hkp-presets")).not.toBeNull();
  });

  it("tells whoever listens once the host's presets are read", async () => {
    const { storage } = memoryStorage([{ file: "one.json", source: JSON.stringify(PRESET) }]);
    const heard = vi.fn();
    const unsubscribe = subscribePresets(heard);
    await attachPresetStorage(storage);
    unsubscribe();
    expect(heard).toHaveBeenCalled();
  });
});

describe("presets imported from a URL", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const respond = (body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

  it("remember the address they were typed as", async () => {
    vi.stubGlobal("fetch", respond(PRESET));
    const [preset] = await loadPresetsFromUrl("https://github.com/o/r/blob/main/p.json");
    expect(preset.origin).toBe("https://github.com/o/r/blob/main/p.json");
  });

  it("are updated from there only when asked", async () => {
    vi.stubGlobal("fetch", respond(PRESET));
    const [preset] = await loadPresetsFromUrl("https://example.com/p.json");
    savePreset(preset);

    vi.stubGlobal("fetch", respond({ ...PRESET, name: "ElevenLabs v2" }));
    expect(savedPresets()[0].name).toBe("ElevenLabs");
    await updatePresetFromOrigin(savedPresets()[0]);
    expect(savedPresets()).toHaveLength(1);
    expect(savedPresets()[0].name).toBe("ElevenLabs v2");
    expect(savedPresets()[0].origin).toBe("https://example.com/p.json");
  });

  it("say so when the address no longer holds them", async () => {
    vi.stubGlobal("fetch", respond({ ...PRESET, id: "something-else" }));
    await expect(
      updatePresetFromOrigin({ ...parsePreset(PRESET), origin: "https://example.com/p.json" }),
    ).rejects.toThrow(/no longer holds/);
  });
});

describe("presets used as blocks", () => {
  const PIPELINE = {
    preset: "v1",
    id: "notify",
    name: "Notify",
    serviceId: "sub-service",
    params: { topic: "t" },
    state: { pipeline: [{ serviceId: "map", instanceId: "m", state: { url: "{{param.topic}}" } }] },
  };

  it("are sub-service pipelines that declare params", () => {
    expect(isUsableAsBlock(parsePreset(PIPELINE))).toBe(true);
    expect(isUsableAsBlock(parsePreset({ ...PIPELINE, params: undefined }))).toBe(false);
    expect(isUsableAsBlock(parsePreset({ ...PIPELINE, serviceId: "map" }))).toBe(false);
    expect(isUsableAsBlock(parsePreset(PRESET))).toBe(false);
  });

  it("include the shipped ntfy notification", () => {
    const ntfy = builtInPresets().find((preset) => preset.id === "ntfy-notification");
    expect(ntfy).toBeDefined();
    expect(isUsableAsBlock(ntfy!)).toBe(true);
    expect(Object.keys(ntfy!.params!)).toEqual(["topic", "title", "priority", "tags", "server"]);
  });
});
