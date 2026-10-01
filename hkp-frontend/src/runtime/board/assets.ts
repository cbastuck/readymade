/**
 * Board assets, in one place.
 *
 * An asset is content — a page, a script, an image, an audio sample, a model —
 * declared once in a board and named from service state by reference. The
 * board holds *descriptors*: an id, a media type and exactly one source, which
 * is the content itself (`text`, `base64`) or where it lives (`url`).
 *
 *   A reference — `hkp-asset://<id>` — is what service state holds, as a whole
 *   field. `getState` echoes it and a saved board keeps it: the content never
 *   enters state, so there is nothing to take back out on save.
 *
 *   Resolution happens in the runtime that uses the content, at the moment it
 *   uses it, from that runtime's asset store. The store is pushed the
 *   descriptors its services reference — with the create payload, before a
 *   configuration that names a new one, and again whenever an asset is edited —
 *   so an edit changes what is served without reconfiguring anything.
 *
 * References are *found* by their scheme anywhere in a string, so that one an
 * expression produces is still pushed to the runtime that will resolve it. They
 * are *resolved* only as a whole value: nothing is spliced into longer text.
 *
 * The format matches hkp-node's `src/assets.ts`: a board written against one
 * runtime has to open against another.
 */

import { mapStrings } from "./traversal";

export const ASSET_SCHEME = "hkp-asset://";

const ID = "[A-Za-z0-9_.-]+";
const ID_PATTERN = new RegExp(`^${ID}$`);
const WHOLE_REFERENCE = /^hkp-asset:\/\/([A-Za-z0-9_.-]+)$/;
const ANY_REFERENCE = /hkp-asset:\/\/([A-Za-z0-9_.-]+)/g;

export type AssetSource =
  | { text: string }
  | { base64: string }
  | { url: string; headers?: Record<string, string> };

export type AssetDescriptor = {
  id: string;
  /** What a person calls it; the id is what references use. */
  name?: string;
  mediaType: string;
  /** Identity of the version: cache key and integrity check. */
  sha256?: string;
  /** For the view, and for refusing oversized inline content. */
  size?: number;
} & AssetSource;

/** Where an asset's content is, as the asset view names it. */
export type AssetSourceKind = "text" | "base64" | "url";

/** What a runtime says about an asset it was asked to resolve. */
export type AssetCheck =
  | { ok: true; mediaType: string; size: number }
  | { ok: false; problem: string };

/** What the runtimes are sent: descriptors by id, `null` for one deleted. */
export type AssetPush = Record<string, AssetDescriptor | null>;

/**
 * The descriptors a runtime's services may reference: those of the document
 * that contributed the runtime. Read on each call, so an asset edited while the
 * board runs is what the next push or resolution sees.
 */
export type AssetsSource = () => AssetDescriptor[];

export function isAssetId(value: string): boolean {
  return ID_PATTERN.test(value);
}

/**
 * The id a whole-value reference names, or null for anything else — a blank, a
 * literal, a reference inside longer text.
 */
export function parseAssetRef(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(WHOLE_REFERENCE);
  return match ? match[1] : null;
}

export function formatAssetRef(id: string): string {
  return `${ASSET_SCHEME}${id}`;
}

/**
 * Every asset id a value mentions, in the order they were found and without
 * duplicates. Walks the whole value — services nest, and a reference is legal
 * in whatever field a service resolves — and matches inside strings, so an
 * expression that picks between assets is still seen to reference them.
 */
export function findAssetRefs(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    for (const match of value.matchAll(ANY_REFERENCE)) {
      if (!into.includes(match[1])) {
        into.push(match[1]);
      }
    }
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      findAssetRefs(item, into);
    }
    return into;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      findAssetRefs(item, into);
    }
  }
  return into;
}

/**
 * The descriptors a set of services references, by id — what a runtime hosting
 * them is sent. Only those: a board's inline assets can be large, and a runtime
 * holds nothing it has no use for. A reference to an asset the board does not
 * declare is left out, and the service naming it says so when it resolves.
 */
export function referencedAssets(
  services: Array<{ state?: unknown }> | undefined,
  assets: AssetDescriptor[] | undefined,
): Record<string, AssetDescriptor> {
  const wanted = findAssetRefs((services ?? []).map((svc) => svc.state));
  const found: Record<string, AssetDescriptor> = {};
  for (const id of wanted) {
    const descriptor = assets?.find((asset) => asset.id === id);
    if (descriptor) {
      found[id] = descriptor;
    }
  }
  return found;
}

export function assetSourceKind(asset: AssetDescriptor): AssetSourceKind {
  if ("text" in asset) {
    return "text";
  }
  if ("base64" in asset) {
    return "base64";
  }
  return "url";
}

/**
 * How many bytes an asset holds: what it declares, or what its inline content
 * measures. Unknown for a URL that declares nothing.
 */
export function assetSize(asset: AssetDescriptor): number | undefined {
  if (typeof asset.size === "number") {
    return asset.size;
  }
  if ("text" in asset) {
    return new TextEncoder().encode(asset.text).length;
  }
  if ("base64" in asset) {
    const padding = asset.base64.endsWith("==") ? 2 : asset.base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((asset.base64.length * 3) / 4) - padding);
  }
  return undefined;
}

/** Whether content of this media type is text a person can edit as text. */
export function isTextMediaType(mediaType: string): boolean {
  const type = mediaType.split(";")[0].trim().toLowerCase();
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type.endsWith("+json") ||
    type === "application/javascript" ||
    type === "application/xml" ||
    type.endsWith("+xml")
  );
}

/** One place a service's state names an asset. */
export type AssetUse = {
  runtimeId: string;
  serviceUuid: string;
  serviceName?: string;
  /** Keys from the service's state down to the string holding the reference. */
  path: Array<string | number>;
  assetId: string;
};

/**
 * Every place the board's services name an asset — the asset view's *Used by*.
 * Found by a scan for the scheme, so it is always what the board holds now.
 */
export function findAssetUses(
  services: {
    [runtimeId: string]: Array<{ uuid: string; serviceName?: string; state?: unknown }>;
  },
  assetId?: string,
): AssetUse[] {
  const uses: AssetUse[] = [];
  for (const [runtimeId, list] of Object.entries(services ?? {})) {
    for (const svc of list ?? []) {
      const walk = (value: unknown, path: Array<string | number>) => {
        if (typeof value === "string") {
          for (const id of findAssetRefs(value)) {
            if (!assetId || id === assetId) {
              uses.push({
                runtimeId,
                serviceUuid: svc.uuid,
                serviceName: svc.serviceName,
                path,
                assetId: id,
              });
            }
          }
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item, index) => walk(item, [...path, index]));
          return;
        }
        if (value && typeof value === "object") {
          for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            walk(item, [...path, key]);
          }
        }
      };
      walk(svc.state, []);
    }
  }
  return uses;
}

/**
 * A value with every reference to `from` naming `to` instead — whole values and
 * mentions inside text alike, which is what renaming an asset has to reach.
 * Returns the same object when nothing referenced it, so a caller can tell
 * which services need reconfiguring.
 */
export function renameAssetRefs<T>(value: T, from: string, to: string): T {
  const pattern = new RegExp(
    `hkp-asset://${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_.-])`,
    "g",
  );
  if (!findAssetRefs(value).includes(from)) {
    return value;
  }
  return mapStrings(value, (text) => text.replace(pattern, formatAssetRef(to)));
}

/**
 * One descriptor as a board declares it, or the reason it is not one. Exactly
 * one source: two would leave a runtime choosing between them.
 */
export function checkAssetDescriptor(value: unknown): AssetDescriptor | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "an asset is an object";
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !isAssetId(record.id)) {
    return `${JSON.stringify(record.id)} is not an asset id: use letters, digits, ".", "-" and "_"`;
  }
  const sources = (["text", "base64", "url"] as const).filter(
    (key) => typeof record[key] === "string",
  );
  if (sources.length !== 1) {
    return `asset "${record.id}" needs exactly one of text, base64 or url`;
  }
  if (typeof record.mediaType !== "string" || !record.mediaType) {
    return `asset "${record.id}" has no mediaType`;
  }
  return record as AssetDescriptor;
}

/**
 * A board's `assets`, read for loading: what can be used, and a sentence for
 * each entry that cannot. An entry that is dropped costs that one asset — the
 * services naming it say so when they resolve — rather than the board.
 */
export function readBoardAssets(value: unknown): {
  assets: AssetDescriptor[];
  problems: string[];
} {
  if (value === undefined) {
    return { assets: [], problems: [] };
  }
  if (!Array.isArray(value)) {
    return { assets: [], problems: ['"assets" is not a list'] };
  }
  const assets: AssetDescriptor[] = [];
  const problems: string[] = [];
  for (const entry of value) {
    const checked = checkAssetDescriptor(entry);
    if (typeof checked === "string") {
      problems.push(checked);
      continue;
    }
    if (assets.some((asset) => asset.id === checked.id)) {
      problems.push(`asset "${checked.id}" is declared twice; the first is kept`);
      continue;
    }
    assets.push(checked);
  }
  return { assets, problems };
}

/** The list with `asset` in place of the one it replaces, or appended. */
export function upsertAsset(
  assets: AssetDescriptor[] | undefined,
  asset: AssetDescriptor,
  replacing: string = asset.id,
): AssetDescriptor[] {
  const list = assets ?? [];
  const index = list.findIndex((entry) => entry.id === replacing);
  if (index < 0) {
    return [...list, asset];
  }
  return list.map((entry, at) => (at === index ? asset : entry));
}

/** An id not yet taken, derived from `base`. */
export function uniqueAssetId(assets: AssetDescriptor[] | undefined, base: string): string {
  const stem =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset";
  const taken = new Set((assets ?? []).map((asset) => asset.id));
  if (!taken.has(stem)) {
    return stem;
  }
  for (let n = 2; ; n++) {
    if (!taken.has(`${stem}-${n}`)) {
      return `${stem}-${n}`;
    }
  }
}
