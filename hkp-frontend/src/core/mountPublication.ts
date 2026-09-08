/**
 * Handing resolved mount addresses to services that cannot resolve them.
 *
 * A service hosted by this browser asks the coordinator whenever it needs an
 * address (see `core/coordinator`). A service on a remote runtime cannot: it
 * sees its own runtime and nothing else, while a reference names a service
 * somewhere else on the board, possibly on another machine. So the coordinator
 * pushes instead — it configures the consumer with the plain address, which is
 * the same value that service would have been given had the board been
 * exported.
 *
 * This runs whenever board state changes rather than once at load, because a
 * board restores its runtimes concurrently: when a consumer is created its
 * owner has usually not published an address yet, and a mount can also appear
 * much later, when a service is unbypassed by hand.
 *
 * hkp-node's coordinator does the same for the boards it owns; see
 * `hkp-node/src/coordinator/session.ts`.
 */

import { BoardCoordinator } from "./coordinator";
import { MOUNT_FIELD, findMountRefs } from "../runtime/board/mount";

export type MountConfigure = {
  runtimeId: string;
  serviceUuid: string;
  url: string;
};

type BoardView = {
  runtimes: Array<{ id: string; type: string }>;
  services: {
    [runtimeId: string]: Array<{ uuid: string; state?: unknown }>;
  };
};

/** Key identifying what was last handed to a service. */
export function configureKey(runtimeId: string, serviceUuid: string): string {
  return `${runtimeId}/${serviceUuid}`;
}

/**
 * The services that hold an unresolved reference the coordinator can now
 * resolve, and the address each should be given.
 *
 * A reference is looked for **anywhere in a service's state**, because it is
 * written in whatever field the service calls its target. The address goes back
 * in `__hkpMount` — never over the field the reference was found in, which is
 * what a person wrote and what the board saves.
 *
 * Runs on every board change rather than once at load: runtimes restore
 * concurrently, so when a consumer appears its owner has usually published
 * nothing yet; a mount can also appear much later, when a server is unbypassed
 * by hand, and an address can change when a runtime is restarted. `sent` records
 * the address last handed to each consumer, so an unrelated state change
 * re-configures nobody while a *changed* address still gets through.
 */
export function pendingMountConfigures(
  board: BoardView,
  coordinator: BoardCoordinator,
  sent: Map<string, string>,
  isRemote: (runtimeType: string) => boolean,
): MountConfigure[] {
  const pending: MountConfigure[] = [];

  for (const runtime of board.runtimes) {
    // Services this browser hosts resolve for themselves, on demand.
    if (!isRemote(runtime.type)) {
      continue;
    }
    for (const service of board.services[runtime.id] ?? []) {
      const state = service.state as Record<string, unknown> | undefined;
      const refs = findMountRefs(state);
      if (refs.length === 0) {
        continue;
      }
      if (refs.length > 1) {
        // One address field, so one mount per consumer. A service that needs
        // two is a service that should host a pipeline instead.
        console.warn(
          `Service "${runtime.id}/${service.uuid}" names ${refs.length} mounts; only the first is resolved`,
        );
      }
      const url = coordinator.resolveMountUrl(refs[0]);
      if (!url) {
        // The owner has not published yet. Normal while a board comes up; the
        // next state change tries again.
        continue;
      }
      if (sent.get(configureKey(runtime.id, service.uuid)) === url) {
        continue;
      }
      // Already carrying this address — a board restored from a previous run,
      // or a state read that came back after the configure landed.
      if (state?.[MOUNT_FIELD] === url) {
        continue;
      }
      pending.push({ runtimeId: runtime.id, serviceUuid: service.uuid, url });
    }
  }

  return pending;
}
