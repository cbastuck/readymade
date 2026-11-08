import { referencedSecrets, secretReference } from "hkp-frontend/src/core/secrets";
import type { BoardDescriptor, RuntimeDescriptor, RuntimeScope } from "hkp-frontend/src/types";

import { pushSecrets } from "./RuntimeRestApi";
import RuntimeRestScope from "./RuntimeRestScope";

/** What this needs of an open board. */
type OpenBoard = {
  runtimes: RuntimeDescriptor[];
  scopes: { [runtimeId: string]: RuntimeScope };
  serializeBoard: () => Promise<BoardDescriptor | null>;
};

/**
 * Hands a secret just stored to the open board's remote runtimes that refer to
 * it.
 *
 * A remote runtime is given its values when it is created and when a
 * configuration names one, so a value stored while a board runs would otherwise
 * reach it only when the board is opened again — which, where secrets live in
 * the page's memory, is never: reopening by reload forgets them. Only the alias
 * stored is sent, and only to a runtime whose services name it, so the consent
 * prompt asks about exactly that.
 *
 * The board is serialized rather than read from its services, because a
 * reference may sit in a block use's params or in state the board has not
 * fetched yet; the serialized board is what holds every one.
 */
export async function pushSecretToBoard(
  board: OpenBoard | null,
  alias: string,
): Promise<void> {
  if (!board) {
    return;
  }
  const remotes = board.runtimes
    .map((runtime) => board.scopes[runtime.id])
    .filter((scope): scope is RuntimeRestScope => scope instanceof RuntimeRestScope);
  if (!remotes.length) {
    return;
  }
  const serialized = await board.serializeBoard();
  for (const scope of remotes) {
    const services = serialized?.services[scope.descriptor.id] ?? [];
    if (!referencedSecrets(services).includes(alias)) {
      continue;
    }
    await pushSecrets(
      scope.descriptor,
      [{ state: secretReference(alias) }],
      scope.authenticatedUser,
      scope.boardName,
    );
  }
}
