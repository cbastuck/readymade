/**
 * Consent for releasing secrets to a runtime.
 *
 * Provisioning a remote runtime hands it credential values (see
 * `runtime/rest/RuntimeRestApi.ts`). A board chooses which services run there
 * and which secrets they name, and a board is not trusted — so the person whose
 * vault it is gets asked before anything leaves: *runtime `node` at
 * `https://rest.example` may retrieve `imap.password`, `slack`.*
 *
 * The grant is keyed by **board, runtime id, origin and alias set**, and all
 * four matter:
 *
 * - the **origin**, because a runtime id is board-controlled and means nothing
 *   alone — the same `node` is repointed at another server by editing one
 *   field, and a grant that ignored the address would follow it there;
 * - the **alias set**, because a board edited later to also want `gmail` would
 *   otherwise inherit the grant it was given for `slack`. A request already
 *   covered proceeds silently; anything new is asked about, and only the new
 *   part.
 *
 * Nothing here is a secret, so grants live in ordinary storage. What they
 * protect is the release of values that live somewhere else entirely.
 */

/** What is about to be released, and to where. */
export type SecretRelease = {
  /** The board asking. Grants do not carry across boards. */
  boardName: string;
  /** The runtime as the board names it. Part of the key: it is stable. */
  runtimeId: string;
  /**
   * What the runtime is called, for saying which one is being asked about.
   * Not part of the key — a name is editable and two runtimes may share one.
   */
  runtimeName?: string;
  /** The runtime server's address. */
  url: string;
  /** The aliases this release would send. */
  aliases: string[];
};

export type ConsentDecision = {
  /** The aliases the person allowed. An empty list is a refusal. */
  allowed: string[];
  /** Whether to remember the answer for this board, runtime and origin. */
  remember: boolean;
};

/** Asks a person. Registered by a host that has somewhere to ask. */
export type ConsentPrompt = (request: SecretRelease) => Promise<ConsentDecision>;

/** Where remembered grants are kept between sessions. */
export type GrantStore = {
  granted(key: string): string[];
  grant(key: string, aliases: string[]): void;
};

/**
 * The origin of a runtime server, or the address as given when it is not a URL.
 *
 * Port included, deliberately: `localhost:8080` and `localhost:9000` are two
 * different processes, and a grant to one is not a grant to the other.
 */
export function releaseOrigin(url: string): string {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return (url ?? "").trim().toLowerCase();
  }
}

/**
 * Whether an address reaches a runtime inside this process.
 *
 * Releasing a secret to one moves nothing between processes, so there is
 * nothing to consent to. Two addresses reach it, and the caller supplies what
 * only it can know:
 *
 * - **the `hkp:` scheme**, which a host serves itself. `hkp://remotes/<name>`
 *   is forwarded in-process only for the host's own name and refused for any
 *   other, and every genuinely remote runtime is listed with its real URL — so
 *   the scheme alone settles it and no name needs checking.
 * - **loopback on `runtimePort`**, the same runtime bound to a port so other
 *   machines can reach it. Only the host knows which port is its own; from here
 *   it is indistinguishable from a development server on the next one, and a
 *   development server is a separate process whose grant is a real release.
 *
 * With no `runtimePort` given, only the scheme answers. That is a host that
 * binds no port, and guessing one would be guessing which neighbour to trust.
 */
export function inProcessRuntime(url: string, runtimePort?: number): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "hkp:") {
    return true;
  }
  if (!runtimePort) {
    return false;
  }
  const loopback =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "[::1]" ||
    parsed.hostname === "::1";
  return loopback && parsed.port === String(runtimePort);
}

export function grantKey(request: SecretRelease): string {
  return [
    request.boardName || "(unsaved)",
    request.runtimeId,
    releaseOrigin(request.url),
  ].join(" ");
}

const STORAGE_PREFIX = "hkp.secret-grants";

/**
 * Grants in `localStorage`, which is what both the app and the website have.
 *
 * A store that is unavailable — a private window, storage disabled — answers
 * "nothing granted", so consent is asked for again rather than assumed.
 */
const localGrantStore: GrantStore = {
  granted(key: string): string[] {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed)
        ? parsed.filter((alias): alias is string => typeof alias === "string")
        : [];
    } catch {
      return [];
    }
  },
  grant(key: string, aliases: string[]): void {
    try {
      const merged = [...new Set([...this.granted(key), ...aliases])].sort();
      window.localStorage.setItem(
        `${STORAGE_PREFIX}:${key}`,
        JSON.stringify(merged),
      );
    } catch {
      // Nothing durable to write to. The grant holds for this session only,
      // which means being asked again next time — the safe direction.
    }
  },
};

let prompt: ConsentPrompt | null = null;
let grants: GrantStore = localGrantStore;
let inProcess: (url: string) => boolean = () => false;

/**
 * Registers how to ask, where to remember, and what needs no asking.
 *
 * `isInProcess` marks a runtime that is not reached over a wire at all — the
 * embedded one inside the app, where releasing a secret moves it between two
 * parts of the same process. Only the host can tell that runtime from a dev
 * server on loopback, which looks identical from here.
 */
export function setSecretConsent(config: {
  prompt?: ConsentPrompt | null;
  grants?: GrantStore;
  isInProcess?: (url: string) => boolean;
}): void {
  if ("prompt" in config) {
    prompt = config.prompt ?? null;
  }
  if (config.grants) {
    grants = config.grants;
  }
  if (config.isInProcess) {
    inProcess = config.isInProcess;
  }
}

/** For tests, and for a host tearing itself down. */
export function resetSecretConsent(): void {
  prompt = null;
  grants = localGrantStore;
  inProcess = () => false;
}

/** Whether this release has already been agreed to in full. */
export function alreadyGranted(request: SecretRelease): boolean {
  if (!request.aliases.length || inProcess(request.url)) {
    return true;
  }
  const granted = new Set(grants.granted(grantKey(request)));
  return request.aliases.every((alias) => granted.has(alias));
}

/**
 * The aliases that may be released, asking about the ones not covered yet.
 *
 * Returns the granted subset rather than all-or-nothing, so refusing one secret
 * does not withhold the rest: the services naming the refused one report it as
 * unavailable by name, and everything else in the board still runs.
 *
 * With no prompt registered there is nobody to ask, and everything is released.
 * That is the state of a host with no consent UI, and it is the behaviour that
 * existed before this — registering a prompt is what turns the gate on.
 */
export async function allowedSecrets(request: SecretRelease): Promise<string[]> {
  if (!request.aliases.length || inProcess(request.url)) {
    return request.aliases;
  }

  const key = grantKey(request);
  const granted = new Set(grants.granted(key));
  const asking = request.aliases.filter((alias) => !granted.has(alias));
  if (!asking.length || !prompt) {
    return request.aliases;
  }

  // Only the difference is put to the person: what they have already agreed to
  // is not re-litigated every time a board adds one more secret.
  const decision = await prompt({ ...request, aliases: asking });
  const allowed = decision.allowed.filter((alias) => asking.includes(alias));
  if (decision.remember && allowed.length) {
    grants.grant(key, allowed);
  }
  return request.aliases.filter(
    (alias) => granted.has(alias) || allowed.includes(alias),
  );
}
