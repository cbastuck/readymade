import { useSyncExternalStore } from "react";

export type Effort = "default" | "low" | "medium" | "high" | "xhigh" | "max";
export type AssistSettings = {
  provider: "anthropic" | "openai-compatible";
  openAIContextTokens: number;
  openAIThinking: "default" | "off" | "on";
  anthropicToken: string;
  openAICompatibleToken: string;
  openAICompatibleUrl: string;
  mcpKnowledgeUrl: string;
  /** Whether requests carry asset contents, or only their ids and types. */
  includeAssetContents: boolean;
  model: string;
  effort: Effort;
};
const KEY = "readymade.ai-assist.v1";
const EVENT = "readymade-ai-settings";
const defaults: AssistSettings = {
  provider: "anthropic",
  openAIContextTokens: 8192,
  openAIThinking: "default",
  anthropicToken: "",
  openAICompatibleToken: "",
  openAICompatibleUrl: "https://api.openai.com/v1",
  mcpKnowledgeUrl: "",
  includeAssetContents: false,
  model: "",
  effort: "default",
};
let cachedRaw: string | null | undefined;
let cached = defaults;
export function readAssistSettings(): AssistSettings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* Storage may be unavailable. */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = { ...defaults, ...JSON.parse(raw ?? "{}") };
    } catch {
      cached = defaults;
    }
  }
  return cached;
}
export function saveAssistSettings(patch: Partial<AssistSettings>) {
  // Do not claim a token was saved when storage is full or disabled.
  localStorage.setItem(
    KEY,
    JSON.stringify({ ...readAssistSettings(), ...patch }),
  );
  window.dispatchEvent(new Event(EVENT));
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
