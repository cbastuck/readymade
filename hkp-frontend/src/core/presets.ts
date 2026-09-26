/**
 * Presets: a service's configuration as a document.
 *
 * A service is where the work happens, but almost none of the work of *using*
 * one is in choosing it. Choosing `http-client` takes a second; spelling out
 * the URL, the path, the headers and the body shape that a particular API
 * expects is the afternoon. That second part is the same for everybody who
 * calls that API, and it is exactly the part a board cannot share today —
 * sharing it means sharing the whole board around it.
 *
 * A preset is that configuration on its own:
 *
 *     { "preset": "v1", "serviceId": "http-client", "name": "…", "state": { … } }
 *
 * It is a **file**, and that is the point. It is written by hand, kept in a
 * repository, fetched from a URL, dropped from a disk, or produced from a
 * service that is already configured the way someone wants to keep. Nothing
 * about it is tied to the board it came from or the one it is going to: it
 * names a `serviceId` and carries state, and every runtime that hosts that
 * service accepts it, because applying one is an ordinary `configure` call.
 * No runtime knows presets exist.
 *
 * ## Replace, not merge
 *
 * Applying a preset produces *exactly* the preset's configuration, never a mix
 * of it and whatever the service happened to hold. A half-applied preset is the
 * worst of the possible outcomes — a leftover header or body from a previous
 * API silently breaks the request, and the board looks like the preset says it
 * does. So a preset's `state` is the service's whole configuration, and
 * applying one resets the service before configuring it.
 *
 * There is no cross-runtime "reset to defaults" call to do that with, and there
 * should not be one: the runtime already knows how to build a fresh service,
 * and that is what restoring a board does to every service it loads. So
 * applying a preset recreates the instance the same way — removed, created
 * again under **the same uuid and at the same position**, then configured. The
 * uuid is what facade widgets reference and what a mount address is derived
 * from, so keeping it is what makes this an edit rather than a replacement.
 *
 * ## What a preset does not carry
 *
 * - **Secret values.** A preset holds `{{secret.elevenlabs}}`, the same
 *   reference a board holds, resolved at the point of use and never present in
 *   service state (see `core/secrets`). This is what makes a preset safe to
 *   publish: there is nothing in the file to redact. `secrets` names the
 *   aliases for a human — what the key is called, where to get one — and is
 *   display only; the aliases themselves are derived from the state.
 * - **`__hkp*` state.** Those fields belong to board machinery rather than to
 *   the service holding them — `__hkpMount` is an address a coordinator
 *   published onto this instance. A preset neither carries them nor clears
 *   them: they are lifted off the old instance and put back on the new one.
 */

import {
  InstanceId,
  RuntimeClassType,
  RuntimeDescriptor,
  ServiceDescriptor,
  toCanonicalServiceId,
} from "../types";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";
import { referencedSecrets } from "./secrets";
import { substituteParams } from "../runtime/board/params";

/** The only format version there is. */
export const PRESET_FORMAT = "v1";

/** What a preset says about one of the secrets its state refers to. */
export type PresetSecret = {
  /** How to name the key to a person: "ElevenLabs API key". */
  label?: string;
  /** Where the key is obtained. */
  url?: string;
};

export type Preset = {
  /** Format marker. `"v1"`, and how a preset file is recognised at all. */
  preset: string;
  /** Stable identity, unique per service: `elevenlabs-text-to-speech`. */
  id: string;
  /** What it is called in a menu. */
  name: string;
  /** The service this configures. Not a runtime — every runtime hosting that
   *  service takes it. */
  serviceId: string;
  /** The service's whole configuration. Applied after a reset, never merged. */
  state: Record<string, any>;

  description?: string;
  /**
   * Names the instance when the preset is *applied* to a service that already
   * exists. Without one the service keeps its name.
   *
   * Not what a palette card is called, nor what one creates: a card stands for
   * the preset and is named after it.
   */
  serviceName?: string;
  /** The author's revision of this preset. Not the format version. */
  version?: number;
  author?: string;
  homepage?: string;
  /**
   * What this preset *is*, for the browser that organises them.
   *
   * A preset is filed under the service it configures, which is the axis that
   * decides where it can be applied. For most services that is enough — every
   * `http-client` preset is a request to some API. It is not enough for
   * `sub-service`, where the preset is a pipeline and the service says only
   * that it is made of other services: a Telegram responder and a spectral
   * analyser would sit in one undifferentiated bucket. Tags are the second
   * axis, and the one that carries the meaning.
   */
  tags?: string[];
  /**
   * The runtime classes this preset is meant for, when it matters — an API that
   * sets no CORS headers, or a call that carries a credential, wants `rest`
   * rather than the browser. A hint shown to a person, never a restriction:
   * the same service on another runtime still accepts it.
   */
  runtimes?: RuntimeClassType[];
  /** Display information for the aliases `state` refers to, keyed by alias. */
  secrets?: Record<string, PresetSecret>;
  /**
   * The parameters `state` refers to as `{{param.name}}`, each with the value
   * it has when nobody gives it one. Applying a preset substitutes these; a
   * block (`runtime/board/blocks`) — a preset used by reference rather than
   * copied — takes its uses' values instead.
   */
  params?: Record<string, unknown>;
};

/** A preset file holds one preset, or several. */
type PresetFile = Preset | { presets: unknown[] };

/** State whose meaning is defined outside the service holding it. */
function isBoardField(key: string): boolean {
  return key.startsWith("__hkp");
}

function fail(reason: string, what = "preset"): never {
  throw new Error(`Not a ${what}: ${reason}`);
}

/**
 * Reads one preset, rejecting anything that is not one.
 *
 * Presets arrive from a URL somebody typed and files somebody dropped, so this
 * says what is wrong rather than producing a preset that fails later, when the
 * service it was applied to behaves oddly.
 */
export function parsePreset(value: unknown): Preset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("not a JSON object");
  }
  const raw = value as Record<string, any>;
  if (raw.preset !== PRESET_FORMAT) {
    fail(
      raw.preset === undefined
        ? `no "preset" field (expected "${PRESET_FORMAT}")`
        : `unknown format "${raw.preset}" (this build reads "${PRESET_FORMAT}")`,
    );
  }
  return { ...parsePresetBody(raw), preset: PRESET_FORMAT };
}

/**
 * Reads a block definition: a preset in everything but the format marker,
 * which the board's `blocks` field already says. See `runtime/board/blocks`.
 *
 * A block is a sub-service: a use is refreshed by configuring it with its
 * definition, and a sub-service configured with a pipeline rebuilds it in
 * every runtime, so what a definition leaves out of it is gone from each use.
 * Other services take a configure as a patch, which would leave behind what a
 * definition no longer says.
 */
export function parseBlockDefinition(value: unknown): BlockDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("not a JSON object", "block");
  }
  const definition = parsePresetBody(value as Record<string, any>, "block");
  if (toCanonicalServiceId(definition.serviceId) !== "sub-service") {
    fail('"serviceId" must name a sub-service', "block");
  }
  if (!Array.isArray(definition.state.pipeline)) {
    fail('"state.pipeline" is missing or not an array', "block");
  }
  return definition;
}

/** Everything a preset is, apart from the marker saying it is one. */
function parsePresetBody(
  raw: Record<string, any>,
  what = "preset",
): Omit<Preset, "preset"> {
  if (typeof raw.serviceId !== "string" || !raw.serviceId) {
    fail('"serviceId" is missing', what);
  }
  if (typeof raw.name !== "string" || !raw.name) {
    fail('"name" is missing', what);
  }
  if (!raw.state || typeof raw.state !== "object" || Array.isArray(raw.state)) {
    fail('"state" is missing or not an object', what);
  }
  if (
    raw.params !== undefined &&
    (!raw.params || typeof raw.params !== "object" || Array.isArray(raw.params))
  ) {
    fail('"params" is not an object', what);
  }
  const state: Record<string, any> = {};
  for (const [key, entry] of Object.entries(raw.state)) {
    // A file that carries these was written by dumping a running service. The
    // address in one belongs to the board it came from; dropping it here is
    // what keeps a preset independent of that board.
    if (!isBoardField(key)) {
      state[key] = entry;
    }
  }
  return {
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : slug(raw.name),
    name: raw.name,
    serviceId: raw.serviceId,
    tags: normalizeTags(raw.tags),
    state,
  } as Omit<Preset, "preset">;
}

/**
 * A block definition is a preset used by reference instead of copied. Only the
 * format marker is optional: inside a board's `blocks` there is no doubt what
 * the document is.
 */
export type BlockDefinition = Omit<Preset, "preset"> & { preset?: string };

/** The state a preset configures a service with: its parameters substituted. */
export function presetState(preset: Preset): Record<string, any> {
  return substituteParams(preset.state, preset.params ?? {});
}

/**
 * Tags as written, minus the ways two of them can be the same tag.
 *
 * They come from files other people wrote and from a field someone typed into,
 * so `Audio`, `audio ` and `audio` have to land in one place rather than three
 * folders that look alike. Compared without case, kept in the spelling they
 * first arrived in — the author's capitalisation is what a person reads.
 */
export function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Map<string, string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const tag = entry.trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.set(tag.toLowerCase(), tag);
    }
  }
  return seen.size ? [...seen.values()] : undefined;
}

/** Reads a preset file's text: one preset, or `{ "presets": [ … ] }`. */
export function parsePresetFile(text: string): Preset[] {
  let parsed: PresetFile;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    fail(`invalid JSON (${(err as Error).message})`);
  }
  const list = (parsed as { presets?: unknown[] })?.presets;
  if (Array.isArray(list)) {
    return list.map(parsePreset);
  }
  return [parsePreset(parsed)];
}

/** Kebab-cases a name into an id, for a file that did not give one. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The address a preset is actually fetched from.
 *
 * A person who wants to share a preset shares the page they are looking at, and
 * on GitHub that page is not the file. Rewriting it is the difference between
 * pasting a link and knowing to press "Raw" first.
 */
export function presetFetchUrl(url: string): string {
  const github = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/,
  );
  if (github) {
    const [, owner, repo, rest] = github;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${rest}`;
  }
  return url;
}

/** Fetches a preset file from the web. */
export async function loadPresetsFromUrl(url: string): Promise<Preset[]> {
  const res = await fetch(presetFetchUrl(url));
  if (!res.ok) {
    throw new Error(`Could not fetch preset: ${res.status} ${res.statusText}`);
  }
  return parsePresetFile(await res.text());
}

/** Reads a preset file a person picked or dropped. */
export async function loadPresetsFromFile(file: File): Promise<Preset[]> {
  return parsePresetFile(await file.text());
}

/**
 * The secret aliases this preset needs, in the order they appear.
 *
 * Derived from the state rather than read from `secrets`, which only says how
 * to describe one: the state is where an alias is actually used, so it cannot
 * fall out of step with what the preset does.
 */
export function presetSecrets(preset: Preset): string[] {
  return referencedSecrets(preset.state);
}

/** A preset as the file it is shared as. */
export function serializePreset(preset: Preset): string {
  return `${JSON.stringify(preset, null, 2)}\n`;
}

/**
 * Turns a service's current configuration into a preset.
 *
 * The mirror of applying one: what a person has working in front of them is
 * the thing worth keeping, and the state they are looking at already holds
 * `{{secret.…}}` references rather than values, because nothing ever resolved
 * them into it.
 */
export function presetFromService(
  service: ServiceDescriptor,
  state: Record<string, any>,
  name: string,
  extra?: Partial<Preset>,
): Preset {
  const kept: Record<string, any> = {};
  for (const [key, value] of Object.entries(state ?? {})) {
    if (!isBoardField(key)) {
      kept[key] = value;
    }
  }
  return {
    preset: PRESET_FORMAT,
    id: slug(name),
    name,
    serviceId: service.serviceId,
    // The preset's name, not the name the service happened to carry. What was
    // saved is "Telegram responder"; an instance of it created from the palette
    // or configured from the menu should say so, rather than inheriting
    // whatever the sub-service it came from was called.
    serviceName: name,
    ...extra,
    state: kept,
  };
}

/* ------------------------------------------------------------------ *
 * Presets this browser keeps
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "hkp-presets";

/**
 * Presets saved on this device.
 *
 * A place to put one that is not yet a file anybody else has — the working
 * configuration a person wants back tomorrow. Saving to disk is the other half
 * of the same action and is what makes it shareable; this is what makes it
 * immediately reachable from the menu it was saved in.
 */
export function savedPresets(): Preset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // A stored preset is read like any other, so one written by an older build
    // is skipped rather than breaking the list it appears in.
    return parsed.flatMap((entry) => {
      try {
        return [parsePreset(entry)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function writeSavedPresets(presets: Preset[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("Could not store presets", err);
  }
  for (const listener of listeners) {
    listener();
  }
}

const listeners = new Set<() => void>();

/**
 * Told when the presets on this device change.
 *
 * The same list is read from two places that never meet — the start page, where
 * presets are organised, and a service's menu in the playground, where one is
 * picked. Saving in one has to show up in the other, and `localStorage` reports
 * nothing to the tab that wrote it.
 */
export function subscribePresets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Saves a preset on this device, replacing one of the same id and service. */
export function savePreset(preset: Preset): Preset[] {
  const rest = savedPresets().filter(
    (entry) =>
      !(entry.id === preset.id && entry.serviceId === preset.serviceId),
  );
  const next = [...rest, preset];
  writeSavedPresets(next);
  return next;
}

/** Forgets a preset saved on this device. */
export function removeSavedPreset(serviceId: string, id: string): Preset[] {
  const next = savedPresets().filter(
    (entry) => !(entry.id === id && entry.serviceId === serviceId),
  );
  writeSavedPresets(next);
  return next;
}

/* ------------------------------------------------------------------ *
 * Applying
 * ------------------------------------------------------------------ */

/**
 * A service's configuration as it currently stands.
 *
 * What a preset is made from, and the only way to reach it from outside a
 * service: the descriptor a board holds carries the state it was restored with
 * rather than what the service has done since.
 */
export async function readServiceState(
  runtime: RuntimeDescriptor,
  service: InstanceId,
  refs: BoardStateRefs,
): Promise<Record<string, any>> {
  const [scope, api] = getRuntimeScopeApi(runtime.id, refs);
  if (!scope || !api?.getServiceConfig) {
    throw new Error(
      `readServiceState() runtime api is missing: ${runtime.type}`,
    );
  }
  return (await api.getServiceConfig(scope, service)) ?? {};
}

export type ApplyPresetResult = {
  service: ServiceDescriptor;
  /** Aliases the preset refers to, for a caller that wants to say so. */
  secrets: string[];
};

/**
 * Configures a service from a preset, replacing what it held.
 *
 * The instance is recreated rather than reconfigured — see the note at the top
 * of this file on why replace is the only sane semantics and why recreating is
 * how it is reached. Position and uuid survive; `__hkp*` state is carried
 * across; everything else is the preset's.
 */
export async function applyPreset(
  preset: Preset,
  runtime: RuntimeDescriptor,
  service: InstanceId,
  refs: BoardStateRefs,
): Promise<ApplyPresetResult> {
  const [scope, api] = getRuntimeScopeApi(runtime.id, refs);
  if (!scope || !api) {
    throw new Error(
      `applyPreset() runtime api is missing: ${runtime.type}`,
    );
  }

  const services = refs.servicesRef.current![runtime.id] ?? [];
  const index = services.findIndex((svc) => svc.uuid === service.uuid);
  const existing = services[index];
  if (!existing) {
    throw new Error(
      `applyPreset() no service "${service.uuid}" on runtime "${runtime.id}"`,
    );
  }
  // Compared canonically: the legacy `hookup.to/service/` ids are aliases that
  // stay, so a preset authored against one spelling of a service applies to the
  // other. What the preset and the board each say is left as written.
  if (
    toCanonicalServiceId(existing.serviceId) !==
    toCanonicalServiceId(preset.serviceId)
  ) {
    throw new Error(
      `Preset "${preset.name}" configures ${preset.serviceId}, not ${existing.serviceId}`,
    );
  }

  // What the board machinery wrote onto this instance, which outlives any
  // configuration of it. Read before the instance goes away.
  const carried: Record<string, any> = {};
  const current = await Promise.resolve(
    api.getServiceConfig?.(scope, existing),
  ).catch(() => null);
  for (const [key, value] of Object.entries(current ?? {})) {
    if (isBoardField(key)) {
      carried[key] = value;
    }
  }

  await api.removeService(scope, existing);

  // The class rather than the descriptor: a descriptor carries the state of the
  // instance that just went away, and creating from it would hand a runtime the
  // very configuration this replaces.
  const created = await api.addService(
    scope,
    {
      serviceId: existing.serviceId,
      serviceName: preset.serviceName || existing.serviceName,
      version: existing.version,
      capabilities: existing.capabilities,
    },
    existing.uuid,
  );
  if (!created) {
    // The old instance is already gone; leaving the list as it is would show a
    // service that no longer exists.
    refs.setServices((prev) => ({
      ...prev,
      [runtime.id]: (prev[runtime.id] ?? []).filter(
        (svc) => svc.uuid !== existing.uuid,
      ),
    }));
    throw new Error(
      `Could not recreate "${existing.serviceId}" to apply preset "${preset.name}"`,
    );
  }

  // Configured before the new instance is published to the board, and this
  // order is the whole of it. A panel initialises itself once per service
  // *object* — it reads the service's configuration when it first sees one and
  // afterwards only listens for notifications. Publishing first means the panel
  // meets the instance in the moment between its creation and its
  // configuration, reads the defaults, and never hears about the configure that
  // follows: the preset is applied and the panel says otherwise.
  await api.configureService(scope, created, {
    ...presetState(preset),
    ...carried,
  });

  // The name the board shows is the descriptor's, and a runtime that builds a
  // service from its registry answers with the registry's name rather than the
  // one asked for. Said here so a preset names the instance on every runtime.
  const named: ServiceDescriptor = {
    ...created,
    serviceName: preset.serviceName || existing.serviceName,
  };

  const reordered = [...services];
  reordered.splice(index, 1, named);
  refs.setServices((prev) => ({ ...prev, [runtime.id]: reordered }));
  const rearranged = await api.rearrangeServices(scope, reordered);
  if (rearranged) {
    // A runtime answers a rearrange with its own list, which says what it calls
    // this service rather than what the preset does.
    refs.setServices((prev) => ({
      ...prev,
      [runtime.id]: rearranged.map((svc) =>
        svc.uuid === named.uuid
          ? { ...svc, serviceName: named.serviceName }
          : svc,
      ),
    }));
  }

  return { service: named, secrets: presetSecrets(preset) };
}
