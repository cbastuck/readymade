/**
 * The Presets source: every preset this device can offer, by service.
 *
 * Presets are organised here rather than in the playground. A service's menu
 * there answers one question — *which preset do I want on this service* — and
 * it should be a list to pick from, not a place to manage files. Everything
 * that is management (what exists, where it came from, what is in it, importing
 * one, deleting one) belongs to the same browser the boards are organised in.
 *
 * Two axes, in the order that decides what can be done with a preset.
 *
 * **The service comes first.** It is what a preset is keyed by and what limits
 * where it can go: an `http-client` preset is applicable to an `http-client`
 * and to nothing else, and the service's own menu lists exactly that folder.
 *
 * **Tags come second**, in the column after it. For most services the service
 * already says what its presets are — every `http-client` preset is a request
 * to some API — and a tag is a finer cut of that. For `sub-service` it is the
 * only thing that says anything at all: the preset is a whole pipeline, and
 * "made of other services" is not a category. A Telegram responder, a spectral
 * analyser and a geocoding lookup are all `sub-service` presets, and without a
 * second axis they are one undifferentiated bucket that grows forever.
 *
 * A preset with tags lives in each of its tag folders, the way a board lives in
 * each folder it is filed under; a preset with none sits in the service folder
 * itself. So the column appears exactly where something has been said, and a
 * service whose presets are untagged still reads as a plain list.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Preset,
  removeSavedPreset,
  savePreset,
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

  // Refiling a preset is rewriting the file, because its tags are part of it —
  // which is what makes the filing travel with it when it is exported.
  const retag = useCallback((preset: Preset, tags: string[]) => {
    savePreset({ ...preset, tags: tags.length ? tags : undefined });
  }, []);

  return useMemo<FolderNode>(() => {
    // generation is what re-reads the store; the value itself says nothing.
    void generation;

    const node = (preset: Preset): PresetNode => {
      const builtIn = isBuiltInPreset(preset);
      return {
        type: "preset",
        name: preset.name,
        preset,
        builtIn,
        // A shipped preset is part of the build: there is nothing on this
        // device to delete, and nothing to rewrite its tags in.
        onDelete: builtIn ? undefined : () => forget(preset),
        onRetag: builtIn ? undefined : (tags) => retag(preset, tags),
      };
    };

    const services = servicesWithPresets().map<FolderNode>((serviceId) => {
      const presets = presetsForService(serviceId);

      // Keyed without case, labelled by the first spelling that arrived: these
      // tags come from files different people wrote, and "Messaging" and
      // "messaging" are one tag rather than two folders that look alike.
      const byTag = new Map<string, { label: string; presets: Preset[] }>();
      const untagged: Preset[] = [];
      for (const preset of presets) {
        if (preset.tags?.length) {
          for (const tag of preset.tags) {
            const key = tag.toLowerCase();
            const group = byTag.get(key) ?? { label: tag, presets: [] };
            group.presets.push(preset);
            byTag.set(key, group);
          }
        } else {
          untagged.push(preset);
        }
      }

      const tagFolders = [...byTag.values()]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map<FolderNode>((group) => ({
          type: "folder",
          name: group.label,
          art: "linear-gradient(160deg, #8b7ce8, #5a49c4)",
          children: group.presets.map(node),
        }));

      return {
        type: "folder",
        name: serviceId,
        art: "linear-gradient(160deg, #6b5bd6, #3d2fa8)",
        children: [...tagFolders, ...untagged.map(node)],
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
  }, [generation, forget, retag, onImport]);
}
