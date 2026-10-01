/**
 * How a board says which runtime server a runtime belongs on, in one place.
 *
 * An address is only true from where it is dialled: `http://127.0.0.1:8080`
 * names a different machine for everyone who opens the board. So a board may
 * say *which* runtime server it wants instead of how to reach it, and the
 * person's own client — the one place that knows their servers — turns that
 * into an address when the board loads.
 *
 * A runtime carries exactly **one** of three, all of them authored:
 *
 *   `url`      — an address the person wrote.
 *   `remote`   — a name, looked up among the remotes this client keeps.
 *   `requires` — what will do (`{ "kind": "python" }`), matched against them.
 *
 * More than one is an error, never a preference. A name resolves differently
 * for each person, so whoever can put a board in front of you controls whether
 * its name resolves; were an unresolved name to fall back to a `url`, they
 * would get two attempts at making your client dial an address.
 *
 * `hkp://remotes/<name>` is a name in a url's clothing — the spelling boards
 * used before `remote` existed. It counts as a name, not as an address, and is
 * left for the host that serves the `hkp:` scheme to resolve, as it always was.
 *
 * Resolution is never written back. The address a name resolved to lives on
 * the live runtime descriptor, beside the `remote` or `requires` it came from,
 * and a board being saved writes only what was authored (`authoredAddressing`).
 *
 * This module is the vocabulary and the matching. It reaches nothing itself:
 * what a remote reports about itself is supplied by the caller (`RemoteProbe`).
 */

/** What a runtime needs of the server it runs on. An object, so it can grow. */
export type RuntimeRequirement = {
  /** Which runtime server implementation: `node`, `python`, `cpp`, `go`. */
  kind: string;
};

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
  requires?: unknown;
};

export type RuntimeAddressing =
  | { mode: "url"; url: string }
  /** `legacyUrl` is set when the name was spelled `hkp://remotes/<name>`. */
  | { mode: "remote"; name: string; legacyUrl?: string }
  | { mode: "requires"; requires: RuntimeRequirement }
  | { mode: "none" };

/** Scheme and authority of the legacy spelling of a remote's name. */
export const REMOTE_URL_PREFIX = "hkp://remotes/";

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
 * A runtime server's kind in the spelling boards use.
 *
 * hkp-rt has always reported itself as `c++`; a board says `cpp`, which
 * survives being a file name, a tag and a query parameter.
 */
export function normalizeKind(kind: string | undefined): string | undefined {
  if (typeof kind !== "string") {
    return undefined;
  }
  const value = kind.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  return value === "c++" ? "cpp" : value;
}

function isRequirement(value: unknown): value is RuntimeRequirement {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { kind?: unknown }).kind === "string" &&
    !!(value as { kind: string }).kind.trim()
  );
}

/**
 * Which of the three a runtime in a board *document* uses.
 *
 * Throws when it uses more than one, or spells one in a shape that cannot be
 * read — a bare string for `requires`, an empty name. Not meant for a live
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

  if (runtime.requires !== undefined) {
    if (!isRequirement(runtime.requires)) {
      throw new RuntimeAddressingError(
        runtime.id,
        `Runtime "${runtime.id}": "requires" must be an object naming a kind, e.g. { "kind": "python" }`,
      );
    }
    modes.push({
      mode: "requires",
      requires: { kind: normalizeKind(runtime.requires.kind)! },
    });
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
    const said = modes.map((m) => (m.mode === "remote" && m.legacyUrl ? "url" : m.mode));
    throw new RuntimeAddressingError(
      runtime.id,
      `Runtime "${runtime.id}" says where it runs more than once (${said.join(", ")}). ` +
        `A runtime names exactly one of "url", "remote" or "requires".`,
    );
  }
  return modes[0] ?? { mode: "none" };
}

/**
 * The addressing fields a saved board gets for a runtime: what was authored
 * and nothing that was resolved. A runtime with a `remote` or a `requires`
 * keeps that and drops the address it resolved to.
 */
export function authoredAddressing(runtime: AddressedRuntime): {
  url?: string;
  remote?: string;
  requires?: RuntimeRequirement;
} {
  if (typeof runtime.remote === "string" && runtime.remote) {
    return { remote: runtime.remote };
  }
  if (isRequirement(runtime.requires)) {
    return { requires: runtime.requires };
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
): Omit<T, "remote" | "requires"> {
  const { remote: _remote, requires: _requires, ...baked } = runtime;
  return baked;
}

/** What a remote says about itself when asked; see GET /runtimes. */
export type RemoteReport = { kind?: string };

/** Asks a remote what it is. Rejects or returns null when it cannot be asked. */
export type RemoteProbe = (remote: KnownRemote) => Promise<RemoteReport | null>;

export type AddressResolution =
  | {
      ok: true;
      url: string;
      /** How the board said it, for telling a person what happened. */
      mode: "url" | "remote" | "requires";
      /** The remote that was chosen, when one was. */
      remoteName?: string;
    }
  | {
      ok: false;
      reason: "none" | "unknown-remote" | "no-match";
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
 * does not resolve — there is no second source and no fallback. A requirement
 * takes the first remote, in this client's order, that reports the kind asked
 * for: refusing when several match would leave a person with two python
 * servers unable to open an "any python" board at all.
 *
 * Throws `RuntimeAddressingError` for a runtime that is malformed; returns a
 * failed resolution for one that is well-formed and cannot be placed here.
 */
export async function resolveRuntimeAddress(
  runtime: AddressedRuntime,
  remotes: KnownRemote[],
  probe: RemoteProbe,
): Promise<AddressResolution> {
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
      const found = dialable(remotes).find(
        (remote) => remote.name === addressing.name,
      );
      if (!found) {
        return {
          ok: false,
          reason: "unknown-remote",
          message: `Runtime "${runtime.id}" wants the remote "${addressing.name}", which this client does not know`,
        };
      }
      return {
        ok: true,
        url: found.url!,
        mode: "remote",
        remoteName: found.name,
      };
    }

    case "requires": {
      const wanted = addressing.requires.kind;
      const candidates = dialable(remotes);
      // Asked together, chosen in order: the answer must not depend on which
      // server happened to reply first.
      const reports = await Promise.all(
        candidates.map((remote) => probe(remote).catch(() => null)),
      );
      const index = reports.findIndex(
        (report) => normalizeKind(report?.kind) === wanted,
      );
      if (index < 0) {
        return {
          ok: false,
          reason: "no-match",
          message: `Runtime "${runtime.id}" needs a ${wanted} runtime server, and none of this client's remotes is one`,
        };
      }
      return {
        ok: true,
        url: candidates[index].url!,
        mode: "requires",
        remoteName: candidates[index].name,
      };
    }
  }
}
