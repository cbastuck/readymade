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
 * embeds (`EMBEDDED_REMOTE_NAME`).
 *
 * Resolution is never written back. The address a name resolved to lives on
 * the live runtime descriptor, beside the `remote` it came from, and a board
 * being saved writes only what was authored (`authoredAddressing`).
 *
 * This module is the vocabulary and the lookup. It reaches nothing itself.
 */

/** A runtime server this client knows by name. */
export type KnownRemote = {
  name: string;
  url?: string;
  type?: string;
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
      const named = dialable(remotes).find(
        (remote) => remote.name === addressing.name,
      );
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
          message:
            addressing.name === EMBEDDED_REMOTE_NAME
              ? `Runtime "${runtime.id}" wants the runtime the Readymade app embeds ("${EMBEDDED_REMOTE_NAME}"), and there is none here. Open the board in the app, or keep a runtime server under that name`
              : `Runtime "${runtime.id}" wants the remote "${addressing.name}", which this client does not know`,
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
