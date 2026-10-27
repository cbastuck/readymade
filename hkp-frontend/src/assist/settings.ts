import { useSyncExternalStore } from "react";
import { destinationHost } from "../core/secrets";

export type Effort = "default" | "low" | "medium" | "high" | "xhigh" | "max";
export type AssistSettings = {
  provider: "anthropic" | "openai-compatible" | "opencode";
  openAIContextTokens: number;
  openAIThinking: "default" | "off" | "on";
  anthropicToken: string;
  openAICompatibleToken: string;
  openAICompatibleUrl: string;
  openCodeUrl: string;
  openCodeUsername: string;
  openCodePassword: string;
  mcpKnowledgeUrl: string;
  /** Whether requests carry asset contents, or only their ids and types. */
  includeAssetContents: boolean;
  model: string;
  effort: Effort;
};
/** The id of Board Assist's section, in the desktop dialog and on a phone. */
export const ASSIST_SETTINGS_SECTION = "ai-assist";
const KEY = "readymade.ai-assist.v1";
const EVENT = "readymade-ai-settings";
const defaults: AssistSettings = {
  provider: "anthropic",
  openAIContextTokens: 8192,
  openAIThinking: "default",
  anthropicToken: "",
  openAICompatibleToken: "",
  openAICompatibleUrl: "https://api.openai.com/v1",
  openCodeUrl: "http://127.0.0.1:4096",
  openCodeUsername: "opencode",
  openCodePassword: "",
  mcpKnowledgeUrl: "",
  includeAssetContents: false,
  model: "",
  effort: "default",
};

/** The names the provider tokens are kept under in a host's secrets. */
export const ASSIST_TOKEN_ALIASES = {
  anthropicToken: "readymade.assist.anthropic",
  openAICompatibleToken: "readymade.assist.openai-compatible",
  openCodePassword: "readymade.assist.opencode",
} as const;
type TokenField = keyof typeof ASSIST_TOKEN_ALIASES;
const tokenFields = Object.keys(ASSIST_TOKEN_ALIASES) as TokenField[];

/**
 * Where the provider tokens are kept on a host with a secret store: beside
 * every other credential, where a person can see and remove them, instead of
 * in browser storage. `read` answers from the page's copy of the vault;
 * writes go to the host.
 */
export type AssistTokenStore = {
  read(alias: string): string | null;
  write(alias: string, value: string, audience: string[]): Promise<void>;
  remove(alias: string): Promise<void>;
  setAudience(alias: string, audience: string[]): Promise<void>;
};
let tokenStore: AssistTokenStore | null = null;

/**
 * Where a token may be sent: its provider's host. A board can name a token
 * like any other secret, and the audience keeps it from taking one anywhere
 * else.
 */
function tokenAudience(field: TokenField, settings: AssistSettings): string[] {
  const host = destinationHost(
    field === "anthropicToken"
      ? "https://api.anthropic.com"
      : field === "openAICompatibleToken"
        ? settings.openAICompatibleUrl
        : settings.openCodeUrl,
  );
  return host ? [host] : [];
}

function storedRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    /* Storage may be unavailable. */
    return null;
  }
}

/**
 * Keeps the provider tokens in the host's secrets from now on, moving any
 * this device kept in browser storage there. Registered once at start-up by
 * a host that has a secret store; without one they stay in browser storage.
 */
export function setAssistTokenStore(store: AssistTokenStore | null) {
  tokenStore = store;
  if (store) {
    let stored: Partial<AssistSettings> = {};
    try {
      stored = JSON.parse(storedRaw() ?? "{}");
    } catch {
      /* Nothing readable to move. */
    }
    const settings = { ...defaults, ...stored };
    for (const field of tokenFields) {
      const value = stored[field];
      if (typeof value !== "string") continue;
      const alias = ASSIST_TOKEN_ALIASES[field];
      // A token already in the vault is the one kept; the copy is only
      // dropped, and only once the vault holds one.
      void (
        value && store.read(alias) === null
          ? store.write(alias, value, tokenAudience(field, settings))
          : Promise.resolve()
      )
        .then(() => {
          const now = JSON.parse(storedRaw() ?? "{}");
          delete now[field];
          localStorage.setItem(KEY, JSON.stringify(now));
          window.dispatchEvent(new Event(EVENT));
        })
        .catch(() => {
          // Left where it was, and read from there, until a write succeeds.
        });
    }
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Whether the provider tokens are kept in the host's secrets. */
export function assistTokensInVault(): boolean {
  return tokenStore !== null;
}

let cachedKey: string | undefined;
let cached = defaults;
export function readAssistSettings(): AssistSettings {
  const raw = storedRaw();
  const held = tokenFields.map(
    (field) => tokenStore?.read(ASSIST_TOKEN_ALIASES[field]) ?? null,
  );
  const key = JSON.stringify([raw, held]);
  if (key !== cachedKey) {
    cachedKey = key;
    try {
      cached = { ...defaults, ...JSON.parse(raw ?? "{}") };
    } catch {
      cached = defaults;
    }
    // What the vault holds wins over a copy not yet moved out of storage.
    tokenFields.forEach((field, i) => {
      if (held[i] !== null) cached = { ...cached, [field]: held[i] };
    });
  }
  return cached;
}

/**
 * Saves preferences. What goes to browser storage is written at once and
 * throws if it cannot be — do not claim a token was saved when storage is
 * full or disabled. Tokens kept in the host's secrets are written there, and
 * the promise says whether that worked.
 */
export function saveAssistSettings(
  patch: Partial<AssistSettings>,
): Promise<void> {
  const next = { ...readAssistSettings(), ...patch };
  const local: Partial<AssistSettings> = { ...patch };
  const writes: Promise<void>[] = [];
  if (tokenStore) {
    const store = tokenStore;
    for (const field of tokenFields) {
      const value = patch[field];
      if (value === undefined) continue;
      // Not kept in storage beside the vault, including a copy not yet moved.
      local[field] = undefined;
      const alias = ASSIST_TOKEN_ALIASES[field];
      writes.push(
        value
          ? store.write(alias, value, tokenAudience(field, next))
          : store.read(alias) !== null
            ? store.remove(alias)
            : Promise.resolve(),
      );
    }
    // The token follows its server: one moved elsewhere may be sent there.
    if (
      patch.openAICompatibleUrl !== undefined &&
      patch.openAICompatibleToken === undefined &&
      next.openAICompatibleToken
    )
      writes.push(
        store.setAudience(
          ASSIST_TOKEN_ALIASES.openAICompatibleToken,
          tokenAudience("openAICompatibleToken", next),
        ),
      );
    if (
      patch.openCodeUrl !== undefined &&
      patch.openCodePassword === undefined &&
      next.openCodePassword
    )
      writes.push(
        store.setAudience(
          ASSIST_TOKEN_ALIASES.openCodePassword,
          tokenAudience("openCodePassword", next),
        ),
      );
  }
  if (Object.keys(local).length || !tokenStore) {
    let stored: Partial<AssistSettings> = {};
    try {
      stored = JSON.parse(storedRaw() ?? "{}");
    } catch {
      /* Replaced below. */
    }
    localStorage.setItem(KEY, JSON.stringify({ ...stored, ...local }));
  }
  window.dispatchEvent(new Event(EVENT));
  return Promise.all(writes).then(() => {
    window.dispatchEvent(new Event(EVENT));
  });
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useAssistSettings() {
  return useSyncExternalStore(subscribe, readAssistSettings, () => defaults);
}
