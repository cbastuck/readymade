import { releaseOrigin } from "../core/secretConsent";
import { KnownRemote, remoteNameForBoard } from "../runtime/board/remote";
import { BoardDescriptor } from "../types";

/**
 * Addresses a proposal would make this browser contact for the first time.
 *
 * A proposal is written by a model that read text nobody on this side wrote —
 * board assets and state, imported units, knowledge-server results — so an
 * address in it is not trusted just because the person asked for a change.
 * Applying is what makes the browser dial it: a remote runtime receives the
 * person's Readymade sign-in (`RuntimeRestApi`), a service such as
 * WebsocketClient may too, and any service can send board data there. Vault
 * secrets are already asked about per origin (`core/secretConsent`); the
 * sign-in and the data are not, so Board Assist asks before applying.
 *
 * An address counts as known when its origin appears anywhere in the board as
 * it is now, including imported unit documents: it is already contacted.
 */
export type NewAddresses = {
  /** Remote runtimes' servers: they run part of the board and get the sign-in. */
  runtimes: string[];
  /** Any other absolute address in service state, assets or the facade. */
  services: string[];
};

const ABSOLUTE = /^(?:https?|wss?):\/\/\S+$/i;

function collectOrigins(value: unknown, into: Set<string>) {
  if (typeof value === "string") {
    const text = value.trim();
    if (ABSOLUTE.test(text)) into.add(releaseOrigin(text));
  } else if (Array.isArray(value)) {
    for (const item of value) collectOrigins(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectOrigins(item, into);
  }
  return into;
}

function runtimeUrls(board: unknown): string[] {
  const runtimes = (board as { runtimes?: unknown } | null)?.runtimes;
  if (!Array.isArray(runtimes)) return [];
  return runtimes
    .map((runtime) => (runtime as { url?: unknown } | null)?.url)
    .filter((url): url is string => typeof url === "string" && !!url.trim());
}

export function newAddresses(
  current: unknown,
  proposed: unknown,
): NewAddresses {
  const known = collectOrigins(current, new Set());
  const runtimes = new Set<string>();
  for (const url of runtimeUrls(proposed)) {
    const origin = releaseOrigin(url);
    if (!known.has(origin)) runtimes.add(origin);
  }
  const services = new Set<string>();
  for (const origin of collectOrigins(proposed, new Set())) {
    if (!known.has(origin) && !runtimes.has(origin)) services.add(origin);
  }
  return { runtimes: [...runtimes], services: [...services] };
}

export function hasNewAddresses(addresses: NewAddresses) {
  return addresses.runtimes.length > 0 || addresses.services.length > 0;
}

function loopback(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(host)
  );
}

/**
 * Whether requests to this address cross the network unencrypted: plain HTTP
 * to anything but this machine. Tokens and boards sent there can be read on
 * the way. A warning, not a refusal — a model server on the local network is
 * a legitimate setup.
 */
export function unencryptedRemote(address: string): boolean {
  try {
    const url = new URL(address.trim());
    return url.protocol === "http:" && !loopback(url.hostname);
  } catch {
    return false;
  }
}

export type RenamedRuntime = { runtimeId: string; remote: string };

/**
 * A proposal's runtime addresses rewritten as the names of servers this client
 * keeps — the rule the runtime picker follows (`remoteNameForBoard`): a board
 * names its runtime server, so it opens elsewhere without editing, and a name
 * resolves only to a server the person set up, which is why it needs no
 * confirmation before applying.
 *
 * Only an address the model wrote is rewritten. A runtime keeping the `url` it
 * already has in the current board is left as it is: changing how an existing
 * runtime is addressed is the person's call, not a side effect of an edit.
 */
export function nameKeptServers(
  current: BoardDescriptor,
  proposed: BoardDescriptor,
  remotes: KnownRemote[],
): { board: BoardDescriptor; renamed: RenamedRuntime[] } {
  const renamed: RenamedRuntime[] = [];
  const runtimes = proposed.runtimes.map((runtime) => {
    if (typeof runtime.url !== "string" || runtime.remote) return runtime;
    const before = current.runtimes.find((rt) => rt.id === runtime.id);
    if (before?.url === runtime.url) return runtime;
    const remote = remoteNameForBoard(remotes, runtime.url);
    if (!remote) return runtime;
    renamed.push({ runtimeId: runtime.id, remote });
    const { url: _url, ...rest } = runtime;
    return { ...rest, remote };
  });
  return renamed.length
    ? { board: { ...proposed, runtimes }, renamed }
    : { board: proposed, renamed };
}
