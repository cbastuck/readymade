import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { usePresetsFolder } from "../presetsSource";
import { FolderNode, PresetNode } from "../types";
import { parsePreset, savePreset } from "hkp-frontend/src/core/presets";

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

  it("offers the import action only when the host can open one", () => {
    const withImport = renderHook(() =>
      usePresetsFolder({ onImport: () => {} }),
    );
    expect(withImport.result.current.action?.label).toBe("Import preset…");

    const without = renderHook(() => usePresetsFolder());
    expect(without.result.current.action).toBeUndefined();
  });
});
