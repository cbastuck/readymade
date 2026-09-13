import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { usePresetsFolder } from "../presetsSource";
import { FolderNode, PresetNode } from "../types";
import { parsePreset, savePreset } from "hkp-frontend/src/core/presets";

/** A composed building block: the case tags exist for. */
const COMPOSED = {
  preset: "v1",
  id: "telegram-responder",
  name: "Telegram responder",
  serviceId: "sub-service",
  tags: ["Messaging"],
  state: {
    pipeline: [
      { serviceId: "telegram-listener", instanceId: "in", state: {} },
      { serviceId: "telegram-sender", instanceId: "out", state: {} },
    ],
  },
};

const ANALYSER = {
  preset: "v1",
  id: "spectral-analyser",
  name: "Spectral analyser",
  serviceId: "sub-service",
  tags: ["Audio", "messaging"],
  state: { pipeline: [{ serviceId: "fft", instanceId: "fft", state: {} }] },
};

const SAVED = {
  preset: "v1",
  id: "my-weather-api",
  name: "My weather API",
  serviceId: "http-client",
  state: { url: "https://api.example.com", method: "get" },
};

function services(folder: FolderNode): FolderNode[] {
  return folder.children as FolderNode[];
}

function presetsOf(folder: FolderNode, serviceId: string): PresetNode[] {
  const service = services(folder).find((entry) => entry.name === serviceId);
  return (service?.children ?? []) as PresetNode[];
}

describe("the Presets source", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("groups presets under the service they configure", () => {
    const { result } = renderHook(() => usePresetsFolder());

    expect(result.current.name).toBe("Presets");
    expect(result.current.source).toBe(true);
    // The build ships http-client presets, so that service is there with no
    // help from the device's store.
    expect(services(result.current).map((entry) => entry.name)).toContain(
      "http-client",
    );
    const shipped = presetsOf(result.current, "http-client");
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.every((node) => node.type === "preset")).toBe(true);
  });

  it("will not delete what the build ships, and will delete what the device keeps", () => {
    savePreset(parsePreset(SAVED));
    const { result } = renderHook(() => usePresetsFolder());

    const presets = presetsOf(result.current, "http-client");
    const saved = presets.find((node) => node.preset.id === "my-weather-api")!;
    const builtIn = presets.find((node) => node.builtIn)!;

    expect(saved.builtIn).toBe(false);
    expect(saved.onDelete).toBeDefined();
    // A built-in is part of the build: there is nothing on this device to
    // delete, so the row offers nothing that would pretend otherwise.
    expect(builtIn.onDelete).toBeUndefined();

    act(() => saved.onDelete!());

    expect(
      presetsOf(result.current, "http-client").some(
        (node) => node.preset.id === "my-weather-api",
      ),
    ).toBe(false);
  });

  it("re-reads when a preset is saved elsewhere in the app", () => {
    // Saving happens in a service's menu in the playground, on the other side
    // of the app from this source; localStorage tells the writing tab nothing.
    const { result } = renderHook(() => usePresetsFolder());
    const before = presetsOf(result.current, "http-client").length;

    act(() => {
      savePreset(parsePreset(SAVED));
    });

    expect(presetsOf(result.current, "http-client")).toHaveLength(before + 1);
  });

  it("files a tagged preset under each of its tags, not in the service folder", () => {
    // The case the second axis exists for: every composed building block is a
    // sub-service, so that folder says nothing about what any of them does.
    savePreset(parsePreset(COMPOSED));
    savePreset(parsePreset(ANALYSER));
    const { result } = renderHook(() => usePresetsFolder());

    const subService = services(result.current).find(
      (entry) => entry.name === "sub-service",
    )!;
    const tags = (subService.children as FolderNode[]).filter(
      (child) => child.type === "folder",
    );
    // Sorted, and "messaging" is the same tag as "Messaging" — compared without
    // case so one tag cannot become two folders that look alike.
    expect(tags.map((folder) => folder.name)).toEqual(["Audio", "Messaging"]);
    expect(
      (tags[1].children as PresetNode[]).map((node) => node.preset.id).sort(),
    ).toEqual(["spectral-analyser", "telegram-responder"]);
    // Nothing loose: both presets said where they belong.
    expect(
      subService.children.filter((child) => child.type === "preset"),
    ).toHaveLength(0);
  });

  it("leaves an untagged preset in the service folder itself", () => {
    savePreset(parsePreset(SAVED));
    const { result } = renderHook(() => usePresetsFolder());

    // The shipped http-client presets are untagged too: a short list reads as a
    // list, and the column appears where something has been said.
    const presets = presetsOf(result.current, "http-client");
    expect(presets.map((node) => node.preset.id)).toContain("my-weather-api");
    expect(
      services(result.current)
        .find((entry) => entry.name === "http-client")!
        .children.filter((child) => child.type === "folder"),
    ).toHaveLength(0);
  });

  it("refiles a preset by rewriting its tags", () => {
    savePreset(parsePreset(COMPOSED));
    const { result } = renderHook(() => usePresetsFolder());

    const tagged = (
      (
        services(result.current).find((entry) => entry.name === "sub-service")!
          .children[0] as FolderNode
      ).children as PresetNode[]
    )[0];

    act(() => tagged.onRetag!(["Chat", " chat ", "Bots"]));

    const folders = (
      services(result.current).find((entry) => entry.name === "sub-service")!
        .children as FolderNode[]
    ).map((folder) => folder.name);
    // Refiled under both, and the duplicate spelling did not become a folder.
    expect(folders).toEqual(["Bots", "Chat"]);
  });

  it("treats a legacy service id as the same service", () => {
    // The browser's older ids spell a service `hookup.to/service/x`; the
    // backend runtimes spell it `x`. Listing both would split one service's
    // presets across two folders that look like different services.
    savePreset(
      parsePreset({
        ...SAVED,
        id: "legacy-spelling",
        serviceId: "hookup.to/service/http-client",
      }),
    );
    const { result } = renderHook(() => usePresetsFolder());

    expect(services(result.current).map((entry) => entry.name)).not.toContain(
      "hookup.to/service/http-client",
    );
    expect(
      presetsOf(result.current, "http-client").map((node) => node.preset.id),
    ).toContain("legacy-spelling");
  });

  it("offers the import action only when the host can open one", () => {
    const withImport = renderHook(() =>
      usePresetsFolder({ onImport: () => {} }),
    );
    expect(withImport.result.current.action?.label).toBe("Import preset…");

    const without = renderHook(() => usePresetsFolder());
    expect(without.result.current.action).toBeUndefined();
  });
});
