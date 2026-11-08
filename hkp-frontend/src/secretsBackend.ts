/**
 * Where the values behind a host's `{{secret.…}}` references are kept, as the
 * Secrets tab manages them.
 *
 * Every method is optional because hosts differ in what they can do: an older
 * app build holds values but cannot constrain them, a host with no store holds
 * nothing. The tab offers only what a backend answers.
 *
 * Whatever a backend keeps durably, the vault cache (`vault.ts`) is what boards
 * resolve against, so a backend writes through to it. That is the whole of the
 * session backend below; a persistent one writes somewhere else as well.
 */
import {
  vaultAliases,
  vaultAudience,
  vaultDelete,
  vaultSet,
  vaultSetAudience,
} from "./vault";
import type { SecretsHost } from "./views/secrets/secretsModel";

export type SecretsBackend = SecretsHost;

/**
 * Secrets held in this page's memory and nowhere else.
 *
 * What a browser host has until a person picks somewhere to keep them: a
 * value typed here resolves for every board opened in this tab, and is gone
 * when the tab is closed or reloaded. Nothing is written to browser storage,
 * so there is nothing to clear and nothing another visit can read.
 */
export const sessionSecrets: SecretsBackend = {
  listSecrets: async () => vaultAliases(),
  setSecret: async (alias, value) => vaultSet(alias, value),
  deleteSecret: async (alias) => vaultDelete(alias),
  listSecretAudiences: async () =>
    Object.fromEntries(
      vaultAliases()
        .map((alias) => [alias, vaultAudience(alias)] as const)
        .filter(([, audience]) => audience.length),
    ),
  setSecretAudience: async (alias, audience) => vaultSetAudience(alias, audience),
};
