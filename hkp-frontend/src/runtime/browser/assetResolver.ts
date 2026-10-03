/**
 * Resolving an asset reference in the browser runtime.
 *
 * The browser runtime's asset store *is* the board's `assets`: nothing is
 * pushed to it, and a service resolves against the descriptors as they are at
 * the moment it uses one — so an asset edited in the asset view is what the next
 * pass gets. See `runtime/board/assets`.
 *
 * Inline sources decode here; an `http(s)://` source is fetched from this
 * page, which the source's CORS policy has to allow. Other sources — `file://`
 * among them — are not readable by a browser runtime and are refused by name.
 */

import { AssetDescriptor, parseAssetRef } from "../board/assets";

export type ResolvedAsset = {
  id: string;
  mediaType: string;
  bytes: Uint8Array;
};

export type AssetResolution =
  | { asset: ResolvedAsset; problem: "" }
  | { asset: null; problem: string };

/** Content already fetched, by descriptor, so an unchanged URL is not fetched on every pass. */
const fetched = new Map<string, Promise<Uint8Array>>();

function fail(problem: string): AssetResolution {
  return { asset: null, problem };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function load(descriptor: AssetDescriptor): Promise<Uint8Array | string> {
  if ("text" in descriptor) {
    return new TextEncoder().encode(descriptor.text);
  }
  if ("base64" in descriptor) {
    try {
      return decodeBase64(descriptor.base64);
    } catch {
      return "its content is not base64";
    }
  }

  let url: URL;
  try {
    url = new URL(descriptor.url);
  } catch {
    return `${JSON.stringify(descriptor.url)} is not a URL`;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `${url.protocol}// sources cannot be read by a browser runtime`;
  }

  // Pinned by its hash, a URL's content cannot change, so it is fetched once;
  // without one it is fetched on each use, as a runtime server would.
  const key = descriptor.sha256 ? JSON.stringify(descriptor) : null;
  const pending =
    (key && fetched.get(key)) ||
    fetch(url.href).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${url.href} answered ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    });
  if (key) {
    fetched.set(key, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (key) {
      fetched.delete(key);
    }
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * An asset's content for one use, or a sentence saying why there is none: not a
 * reference, an unknown id, a refused source, content that does not decode, a
 * failed fetch, a hash that does not match.
 */
export async function resolveAsset(
  assets: AssetDescriptor[],
  reference: string,
): Promise<AssetResolution> {
  const id = parseAssetRef(reference);
  if (!id) {
    return fail(`${JSON.stringify(reference)} is not an asset reference`);
  }
  const descriptor = assets.find((asset) => asset.id === id);
  if (!descriptor) {
    return fail(`asset "${id}" is not declared by this board`);
  }
  const loaded = await load(descriptor);
  if (typeof loaded === "string") {
    return fail(`asset "${id}": ${loaded}`);
  }
  if (descriptor.sha256) {
    const actual = await sha256Hex(loaded);
    if (actual !== descriptor.sha256.toLowerCase()) {
      return fail(`asset "${id}": content does not match its sha256 (got ${actual})`);
    }
  }
  return { asset: { id, mediaType: descriptor.mediaType, bytes: loaded }, problem: "" };
}
