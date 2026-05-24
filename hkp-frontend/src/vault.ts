import { InstanceId } from "./types";

declare global {
  interface Window {
    __HKP_VAULT__?: Record<string, string>;
  }
}

const cache: Record<string, string> = { ...(window.__HKP_VAULT__ ?? {}) };

export function vaultGet(key: string): string | null {
  return cache[key] ?? null;
}

export function vaultSet(key: string, value: string) {
  cache[key] = value;
}

// TODO: the following two functions are currently under evaluation

// Namespaced accessor kept for backward compat (SecretField, HttpRelayClientUI).
// Keys are stored flat as "${instanceId}.${key}" in the shared cache.
// Used by hkp-frontend/src/components/shared/SecretField.tsx
export function getVault(_vaultId: "uservault") {
  return {
    get: (instanceId: string, key: string) => vaultGet(`${instanceId}.${key}`),
    set: (instanceId: string, key: string, value: string) =>
      vaultSet(`${instanceId}.${key}`, value),
    save: () => {},
  };
}

// used in /hkp-frontend/src/runtime/browser/services/OpenAIPromptUI.tsx
export function secretId(_vaultId: "uservault", svc: InstanceId, key: string) {
  return `${_vaultId}.${svc.uuid}.${key}`;
}
