/**
 * How a board says which runtime server a runtime belongs on, in one place.
 *
 * An address is only true from where it is dialled: `http://127.0.0.1:8080`
 * names a different machine for everyone who opens the board. So a board may
 * say *which* runtime server it wants instead of how to reach it, and the
 * person's own client — the one place that knows their servers — turns that
 * into an address when the board loads.
 *
 * A runtime carries exactly **one** of two, both authored:
 *
 *   `url`    — an address the person wrote.
 *   `remote` — a name, looked up among the remotes this client keeps.
 *
 * Both is an error, never a preference. A name resolves differently
 * for each person, so whoever can put a board in front of you controls whether
 * its name resolves; were an unresolved name to fall back to a `url`, they
 * would get two attempts at making your client dial an address.
 *
 * `hkp://remotes/<name>` is a name in a url's clothing — the spelling boards
 * used before `remote` existed. It counts as a name, not as an address, and is
 * left for the host that serves the `hkp:` scheme to resolve, as it always was.
 *
 * One name is the same for everybody: `embedded`, the runtime the host itself
 * embeds (`EMBEDDED_REMOTE_NAME`). Two more are agreed without being enforced:
 * `node` and `python`, what a board calls a runtime server of that kind when
 * any one of them will do (`SHARED_REMOTE_NAMES`).
 *
 * A remote answers to more than one name: the one it is listed under and any
 * number of aliases (`remoteNames`). A board holds a name for as long as it
 * exists, so a server that is renamed keeps the old one as an alias, and one
 * server can be `Laptop` to its owner and `node` to the boards it opens.
 *
 * Resolution is never written back. The address a name resolved to lives on
 * the live runtime descriptor, beside the `remote` it came from, and a board
 * being saved writes only what was authored (`authoredAddressing`).
 *
 * This module is the vocabulary and the lookup. It reaches nothing itself.
 */

/** A runtime server this client knows by name. */
export type KnownRemote = {
  /** The name it is listed under. */
  name: string;
  url?: string;
  type?: string;
  /** Other names it answers to, beside the one it is listed under. */
  aliases?: string[];
};

/** The fields of a runtime that say where it runs. */
export type AddressedRuntime = {
  id: string;
  url?: string;
  remote?: unknown;
};

export type RuntimeAddressing =
  | { mode: "url"; url: string }
  /** `legacyUrl` is set when the name was spelled `hkp://remotes/<name>`. */
  | { mode: "remote"; name: string; legacyUrl?: string }
  | { mode: "none" };

/** Scheme and authority of the legacy spelling of a remote's name. */
export const REMOTE_URL_PREFIX = "hkp://remotes/";

/**
 * The name of the runtime a host embeds, the same in every host that has one.
 *
 * Each app calls its own runtime something else — the desktop app, the iOS
 * app and the Android app each have their name for it — and outside the app
 * it runs in, such a name means nothing. A board that should run on whichever
 * app opens it says `"remote": "embedded"` instead: no address, so no port
 * that has to be free and known, and no name that is one app's alone.
 */
export const EMBEDDED_REMOTE_NAME = "embedded";

/**
 * The remote a host keeps for the runtime it embeds: the one it serves itself
 * through the `hkp:` scheme rather than reaches over a network. Undefined for
 * a host that embeds none — a browser tab.
 */
export function embeddedRemote(remotes: KnownRemote[]): KnownRemote | undefined {
  return remotes.find(
    (remote) =>
      typeof remote.url === "string" && remote.url.startsWith(REMOTE_URL_PREFIX),
  );
}

/**
 * The names a board uses for a runtime server of a kind, and the kind each
 * stands for.
 *
 * A board that needs an hkp-node and does not care whose says `"remote":
 * "node"`, and whoever opens it keeps their own server under that name —
 * wherever it listens, which is theirs to know and not the board's. That is
 * what lets a board move between people: the port a server was started on,
 * and whether it runs on this machine at all, never enter the document.
 *
 * Unlike `embedded` these are names like any other. No host answers to one
 * unasked, nothing checks what kind of server is kept under it, and a client
 * that keeps none does not resolve it. They are agreed rather than enforced;
 * what is here is the agreement, and what an unresolved one is explained with.
 */
export const SHARED_REMOTE_NAMES: { [name: string]: string } = {
  node: "hkp-node",
  python: "hkp-python",
};

/** The kind of runtime server a name boards share stands for, if it is one. */
export function sharedRemoteKind(name: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(SHARED_REMOTE_NAMES, name)
    ? SHARED_REMOTE_NAMES[name]
    : undefined;
}

/** What to say about a name this client keeps no runtime server under. */
function unknownRemoteMessage(runtimeId: string, name: string): string {
  if (name === EMBEDDED_REMOTE_NAME) {
    return `Runtime "${runtimeId}" wants the runtime the Readymade app embeds ("${EMBEDDED_REMOTE_NAME}"), and there is none here. Open the board in the app, or keep a runtime server under that name`;
  }
  const unknown = `Runtime "${runtimeId}" wants the remote "${name}", which this client does not know`;
  const kind = sharedRemoteKind(name);
  return kind
    ? `${unknown}. "${name}" is what a board calls an ${kind} runtime server: keep yours under that name, with the address it runs at, and open the board again`
    : unknown;
}

/**
 * A list of aliases as it is kept: trimmed, each once, none empty and none
 * the name the remote is listed under already.
 */
export function cleanAliases(name: string, aliases: unknown): string[] {
  if (!Array.isArray(aliases)) {
    return [];
  }
  const kept: string[] = [];
  for (const alias of aliases) {
    const trimmed = typeof alias === "string" ? alias.trim() : "";
    if (trimmed && trimmed !== name && !kept.includes(trimmed)) {
      kept.push(trimmed);
    }
  }
  return kept;
}

/** Every name a remote answers to: the one it is listed under, then its aliases. */
export function remoteNames(remote: KnownRemote): string[] {
  return [remote.name, ...cleanAliases(remote.name, remote.aliases)];
}

/**
 * The remote that answers to `name`.
 *
 * The name a remote is listed under comes before anybody's alias: an alias is
 * a second name for one server, and must not take a board away from the server
 * that is actually called that.
 */
export function findRemote<T extends KnownRemote>(
  remotes: T[],
  name: string,
): T | undefined {
  return (
    remotes.find((remote) => remote.name === name) ??
    remotes.find((remote) => remoteNames(remote).includes(name))
  );
}

/** `remote`, answering to `alias` as well. Unchanged when it already does. */
export function withAlias<T extends KnownRemote>(remote: T, alias: string): T {
  const wanted = alias.trim();
  if (!wanted || remoteNames(remote).includes(wanted)) {
    return remote;
  }
  return {
    ...remote,
    aliases: cleanAliases(remote.name, [...(remote.aliases ?? []), wanted]),
  };
}

/**
 * The name a board is given for a runtime put on the remote at `url`, or
 * undefined when this client keeps no remote there.
 *
 * The most portable name the remote answers to: `embedded` for the runtime the
 * host embeds, then a name boards share for its kind (`SHARED_REMOTE_NAMES`),
 * then the one it is listed under. A board built here then opens elsewhere
 * without being edited, wherever the remote goes by a name others use too.
 */
export function remoteNameForBoard(
  remotes: KnownRemote[],
  url: string | undefined,
): string | undefined {
  if (!url) {
    return undefined;
  }
  const address = (value: string | undefined) => (value ?? "").replace(/\/+$/, "");
  if (address(embeddedRemote(remotes)?.url) === address(url)) {
    return EMBEDDED_REMOTE_NAME;
  }
  const kept = remotes.find(
    (remote) => !!remote.url && address(remote.url) === address(url),
  );
  if (!kept) {
    return undefined;
  }
  const names = remoteNames(kept);
  return names.find((name) => sharedRemoteKind(name)) ?? kept.name;
}

/** A runtime that does not say, or says more than once, where it runs. */
export class RuntimeAddressingError extends Error {
  constructor(
    readonly runtimeId: string,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeAddressingError";
  }
}

/** The name in `hkp://remotes/<name>[/…]`, or undefined for any other url. */
export function remoteNameFromUrl(url: string | undefined): string | undefined {
  if (typeof url !== "string" || !url.startsWith(REMOTE_URL_PREFIX)) {
    return undefined;
  }
  const name = url.slice(REMOTE_URL_PREFIX.length).split(/[/?#]/)[0];
  return name || undefined;
}

/**
 * Which of the two a runtime in a board *document* uses.
 *
 * Throws when it uses both, or spells one in a shape that cannot be read — an
 * empty name. Not meant for a live
 * runtime descriptor: that carries the resolved `url` beside what it resolved
 * from, which is the state this rule forbids a document to be in.
 */
export function addressingOf(runtime: AddressedRuntime): RuntimeAddressing {
  const modes: RuntimeAddressing[] = [];

  if (runtime.remote !== undefined) {
    if (typeof runtime.remote !== "string" || !runtime.remote.trim()) {
      throw new RuntimeAddressingError(
        runtime.id,
        `Runtime "${runtime.id}": "remote" must be the name of a runtime server`,
      );
    }
    modes.push({ mode: "remote", name: runtime.remote.trim() });
  }

  if (typeof runtime.url === "string" && runtime.url) {
    const legacyName = remoteNameFromUrl(runtime.url);
    modes.push(
      legacyName
        ? { mode: "remote", name: legacyName, legacyUrl: runtime.url }
        : { mode: "url", url: runtime.url },
    );
  }

  if (modes.length > 1) {
    const said = modes.map((m) =>
      m.mode === "remote" && m.legacyUrl ? "url" : m.mode,
    );
    throw new RuntimeAddressingError(
      runtime.id,
      `Runtime "${runtime.id}" says where it runs more than once (${said.join(", ")}). ` +
        `A runtime names exactly one of "url" or "remote".`,
    );
  }
  return modes[0] ?? { mode: "none" };
}

/**
 * The addressing fields a saved board gets for a runtime: what was authored
 * and nothing that was resolved. A runtime with a `remote` keeps that and
 * drops the address it resolved to.
 */
export function authoredAddressing(runtime: AddressedRuntime): {
  url?: string;
  remote?: string;
} {
  if (typeof runtime.remote === "string" && runtime.remote) {
    return { remote: runtime.remote };
  }
  return { url: runtime.url };
}

/**
 * A live runtime as it is exported to somewhere this client's names mean
 * nothing: the address its name resolved to, and no name.
 *
 * Baking is an explicit act of export, the counterpart of what a save does. A
 * save keeps the name because whoever opens the board resolves it themselves;
 * an export hands over one concrete runtime, and the receiver has no way to
 * resolve a name that was this client's. Either way the result says where the
 * runtime runs exactly once.
 */
export function bakeAddressing<T extends AddressedRuntime>(
  runtime: T,
): Omit<T, "remote"> {
  const { remote: _remote, ...baked } = runtime;
  return baked;
}

export type AddressResolution =
  | {
      ok: true;
      url: string;
      /** How the board said it, for telling a person what happened. */
      mode: "url" | "remote";
      /** The remote the name resolved to, when the board gave a name. */
      remoteName?: string;
    }
  | {
      ok: false;
      reason: "none" | "unknown-remote";
      message: string;
    };

function dialable(remotes: KnownRemote[]): KnownRemote[] {
  return remotes.filter(
    (remote) => typeof remote.url === "string" && !!remote.url,
  );
}

/**
 * Turns what a board says about a runtime into the address this client dials.
 *
 * Against this client's own remotes and nothing else. A name it does not hold
 * does not resolve — there is no second source and no fallback, and nothing
 * here chooses a remote the board did not name.
 *
 * Throws `RuntimeAddressingError` for a runtime that is malformed; returns a
 * failed resolution for one that is well-formed and cannot be placed here.
 */
export function resolveRuntimeAddress(
  runtime: AddressedRuntime,
  remotes: KnownRemote[],
): AddressResolution {
  const addressing = addressingOf(runtime);

  switch (addressing.mode) {
    case "none":
      return {
        ok: false,
        reason: "none",
        message: `Runtime "${runtime.id}" names no runtime server`,
      };

    case "url":
      return { ok: true, url: addressing.url, mode: "url" };

    case "remote": {
      // The legacy spelling is served by the host itself, which knows the
      // name and refuses one it does not: nothing to look up here.
      if (addressing.legacyUrl) {
        return {
          ok: true,
          url: addressing.legacyUrl,
          mode: "remote",
          remoteName: addressing.name,
        };
      }
      const named = findRemote(dialable(remotes), addressing.name);
      // In a host that embeds a runtime the name is that runtime's, whatever
      // else is kept under it: a board asking for the app's own runtime must
      // not land on a server somebody happened to call the same. A host that
      // embeds none has no such runtime, and there it is a name like any other
      // — one a person may give a server of theirs.
      const found =
        addressing.name === EMBEDDED_REMOTE_NAME
          ? (embeddedRemote(remotes) ?? named)
          : named;
      if (!found) {
        return {
          ok: false,
          reason: "unknown-remote",
          message: unknownRemoteMessage(runtime.id, addressing.name),
        };
      }
      return {
        ok: true,
        url: found.url!,
        mode: "remote",
        remoteName: found.name,
      };
    }
  }
}
