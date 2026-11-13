import { useSyncExternalStore } from "react";
import { destinationHost } from "../core/secrets";

export type Effort = "default" | "low" | "medium" | "high" | "xhigh" | "max";
export type AssistSettings = {
  provider:
    | "anthropic"
    | "mistral"
    | "openai-compatible"
    | "opencode"
    | "opencode-go";
  openAIContextTokens: number;
  openAIThinking: "default" | "off" | "on";
  /**
   * The most a turn may write, reasoning included, in tokens; 0 leaves it to
   * the provider's default. Read when a request starts, so a turn continued
   * after it was cut off gets the limit set since.
   */
  outputLimit: number;
  anthropicToken: string;
  mistralToken: string;
  openAICompatibleToken: string;
  openAICompatibleUrl: string;
  openCodeUrl: string;
  openCodeUsername: string;
  openCodePassword: string;
  /** OpenCode Go's API base, or a relay's that forwards to it. */
  openCodeGoUrl: string;
  openCodeGoToken: string;
  /** What a relay in front of Go asks for, sent as X-Relay-Key; "" for none. */
  openCodeGoRelayKey: string;
  mcpKnowledgeUrl: string;
  /** Whether requests carry asset contents, or only their ids and types. */
  includeAssetContents: boolean;
  model: string;
  effort: Effort;
};
/** The id of Board Assist's section, in the desktop dialog and on a phone. */
export const ASSIST_SETTINGS_SECTION = "ai-assist";
/** OpenCode Go's own API base (`openCodeGo.ts`). */
export const OPENCODE_GO_URL = "https://opencode.ai/zen/go/v1";
/** Mistral's API base (`mistral.ts`). */
export const MISTRAL_URL = "https://api.mistral.ai/v1";
/** The knowledge server Board Assist uses when `mcpKnowledgeUrl` is empty. */
export const DEFAULT_MCP_KNOWLEDGE_URL = "https://mcp.readymadeit.com/mcp";
const KEY = "readymade.ai-assist.v1";
const EVENT = "readymade-ai-settings";
const defaults: AssistSettings = {
  provider: "anthropic",
  openAIContextTokens: 8192,
  openAIThinking: "default",
  outputLimit: 0,
  anthropicToken: "",
  mistralToken: "",
  openAICompatibleToken: "",
  openAICompatibleUrl: "https://api.openai.com/v1",
  openCodeUrl: "http://127.0.0.1:4096",
  openCodeUsername: "opencode",
  openCodePassword: "",
  openCodeGoUrl: OPENCODE_GO_URL,
  openCodeGoToken: "",
  openCodeGoRelayKey: "",
  mcpKnowledgeUrl: "",
  includeAssetContents: false,
  model: "",
  effort: "default",
};

/** The names the provider tokens are kept under in a host's secrets. */
export const ASSIST_TOKEN_ALIASES = {
  anthropicToken: "readymade.assist.anthropic",
  mistralToken: "readymade.assist.mistral",
  openAICompatibleToken: "readymade.assist.openai-compatible",
  openCodePassword: "readymade.assist.opencode",
  openCodeGoToken: "readymade.assist.opencode-go",
  openCodeGoRelayKey: "readymade.assist.opencode-go-relay",
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

/** The address each token is sent to, and which setting holds it. */
const tokenUrls = {
  anthropicToken: () => "https://api.anthropic.com",
  mistralToken: () => MISTRAL_URL,
  openAICompatibleToken: (settings: AssistSettings) =>
    settings.openAICompatibleUrl,
  openCodePassword: (settings: AssistSettings) => settings.openCodeUrl,
  openCodeGoToken: (settings: AssistSettings) => settings.openCodeGoUrl,
  openCodeGoRelayKey: (settings: AssistSettings) => settings.openCodeGoUrl,
} satisfies Record<TokenField, (settings: AssistSettings) => string>;
const tokenUrlFields = {
  openAICompatibleToken: "openAICompatibleUrl",
  openCodePassword: "openCodeUrl",
  openCodeGoToken: "openCodeGoUrl",
  openCodeGoRelayKey: "openCodeGoUrl",
} as const;

/**
 * Where a token may be sent: its provider's host. A board can name a token
 * like any other secret, and the audience keeps it from taking one anywhere
 * else.
 */
function tokenAudience(field: TokenField, settings: AssistSettings): string[] {
  const host = destinationHost(tokenUrls[field](settings));
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
    for (const [field, urlField] of Object.entries(tokenUrlFields) as [
      keyof typeof tokenUrlFields,
      (typeof tokenUrlFields)[keyof typeof tokenUrlFields],
    ][]) {
      if (
        patch[urlField] !== undefined &&
        patch[field] === undefined &&
        next[field]
      )
        writes.push(
          store.setAudience(
            ASSIST_TOKEN_ALIASES[field],
            tokenAudience(field, next),
          ),
        );
    }
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
/** What a provider is called wherever one is shown. */
export const ASSIST_PROVIDER_LABELS: Record<AssistSettings["provider"], string> =
  {
    anthropic: "Anthropic",
    mistral: "Mistral",
    "openai-compatible": "OpenAI compatible",
    opencode: "OpenCode server",
    "opencode-go": "OpenCode Go",
  };
export function useAssistSettings() {
  return useSyncExternalStore(subscribe, readAssistSettings, () => defaults);
}
