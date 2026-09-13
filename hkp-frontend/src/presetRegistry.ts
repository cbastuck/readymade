/**
 * The presets this build ships with.
 *
 * Presets are files, and these are the ones that travel in the repository —
 * the equivalent of the demo boards in `demoRegistry`. A preset is not
 * registered *code*: nothing here is imported by a service, and removing an
 * entry removes a menu item and nothing else.
 *
 * Listed rather than globbed, so a file that fails to parse fails the build
 * instead of quietly not appearing, and so the order in a menu is the order
 * written here.
 */

import { Preset, parsePreset, savedPresets } from "./core/presets";

import elevenlabsTextToSpeech from "../presets/http-client/elevenlabs-text-to-speech.json";
import openaiChatCompletions from "../presets/http-client/openai-chat-completions.json";

const FILES: unknown[] = [elevenlabsTextToSpeech, openaiChatCompletions];

const BUILT_IN: Preset[] = FILES.map(parsePreset);

/** Every preset shipped with this build. */
export function builtInPresets(): Preset[] {
  return BUILT_IN;
}

/** The shipped presets for one service, in the order they are listed. */
export function builtInPresetsFor(serviceId: string): Preset[] {
  return BUILT_IN.filter((preset) => preset.serviceId === serviceId);
}

/**
 * Every preset available for one service: what is saved on this device first,
 * then what the build ships.
 *
 * The single list both surfaces read — the Presets source on the start page,
 * where presets are organised, and a service's menu in the playground, where
 * one is picked. A saved preset comes first because it is the one someone on
 * this machine decided to keep.
 */
export function presetsForService(serviceId: string): Preset[] {
  const saved = savedPresets().filter(
    (preset) => preset.serviceId === serviceId,
  );
  return [...saved, ...builtInPresetsFor(serviceId)];
}

/** Whether a preset is one this build ships, and therefore not one to delete. */
export function isBuiltInPreset(preset: Preset): boolean {
  return BUILT_IN.some(
    (entry) =>
      entry.id === preset.id && entry.serviceId === preset.serviceId,
  );
}

/** Every service that has a preset, saved or shipped, in a stable order. */
export function servicesWithPresets(): string[] {
  const ids = new Set<string>();
  for (const preset of [...savedPresets(), ...BUILT_IN]) {
    ids.add(preset.serviceId);
  }
  return [...ids].sort();
}
