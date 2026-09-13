/**
 * The Presets source: every preset this device can offer, by service.
 *
 * Presets are organised here rather than in the playground. A service's menu
 * there answers one question — *which preset do I want on this service* — and
 * it should be a list to pick from, not a place to manage files. Everything
 * that is management (what exists, where it came from, what is in it, importing
 * one, deleting one) belongs to the same browser the boards are organised in.
 *
 * Two levels under the source: a folder per service that has a preset, then the
 * presets themselves. A service is named by its `serviceId`, because that is
 * the identity a preset is keyed by — the same string the service's menu is
 * reached from — rather than whatever a runtime happens to call it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Preset,
  removeSavedPreset,
  subscribePresets,
} from "hkp-frontend/src/core/presets";
import {
  isBuiltInPreset,
  presetsForService,
  servicesWithPresets,
} from "hkp-frontend/src/presetRegistry";
import { FolderNode, PresetNode } from "./types";

export interface PresetsSourceOptions {
  /** Opens the host's import UI. Shown as the source's action when set. */
  onImport?: () => void;
}

/**
 * Re-reads the presets whenever they change.
 *
 * They live in `localStorage`, which reports nothing to the tab that wrote it,
 * so the store says so itself (`subscribePresets`) and this is how the source
 * hears about a preset saved from a service's menu on the other side of the app.
 */
export function usePresetsFolder(
  options: PresetsSourceOptions = {},
): FolderNode {
  const { onImport } = options;
  const [generation, setGeneration] = useState(0);

  useEffect(() => subscribePresets(() => setGeneration((n) => n + 1)), []);

  const forget = useCallback((preset: Preset) => {
    removeSavedPreset(preset.serviceId, preset.id);
  }, []);

  return useMemo<FolderNode>(() => {
    // generation is what re-reads the store; the value itself says nothing.
    void generation;

    const services = servicesWithPresets().map<FolderNode>((serviceId) => {
      const presets = presetsForService(serviceId);
      return {
        type: "folder",
        name: serviceId,
        art: "linear-gradient(160deg, #6b5bd6, #3d2fa8)",
        children: presets.map<PresetNode>((preset) => {
          const builtIn = isBuiltInPreset(preset);
          return {
            type: "preset",
            name: preset.name,
            preset,
            builtIn,
            onDelete: builtIn ? undefined : () => forget(preset),
          };
        }),
        emptyHint: "No presets for this service",
      };
    });

    return {
      type: "folder",
      name: "Presets",
      source: true,
      children: services,
      emptyHint: "Import a preset to configure a service from a file",
      action: onImport
        ? { label: "Import preset…", onClick: onImport }
        : undefined,
    };
  }, [generation, forget, onImport]);
}
