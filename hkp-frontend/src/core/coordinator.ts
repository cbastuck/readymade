/**
 * The coordinator: the instance that owns a board.
 *
 * A board is coordinated by exactly one instance, which holds the board's
 * engine state — its runtimes, its services, and the state each of those last
 * reported. Everything that needs a view of the *whole* board rather than one
 * runtime belongs here.
 *
 * Which instance that is depends on how the board runs, and the two roles are
 * not the same even when one process plays both:
 *
 * - Playground and Readymade: the browser coordinates the board *and* hosts its
 *   browser runtimes.
 * - Cloud boards: hkp-node coordinates, provisions the remote runtimes, and
 *   calls back into a connected browser for the browser runtimes it does not
 *   host.
 *
 * A runtime host may hand this capability to the services it hosts (see
 * `AppInstance.coordinator`), which is how a service reaches beyond its own
 * runtime. A host that cannot see the board leaves it unset, and callers treat
 * an absent coordinator the same as an unresolved lookup.
 */

import {
  MountEndpoint,
  MOUNT_FIELD,
  parseMountEndpoint,
  parseMountRef,
  substituteMountsInBoard,
} from "../runtime/board/mount";

/**
 * The part of a board's engine state a coordinator reads. Kept structural so
 * any holder of board state can provide one without depending on the React
 * board context.
 */
export type CoordinatorState = {
  services: {
    [runtimeId: string]: Array<{ uuid: string; state?: unknown }>;
  };
};

export interface BoardCoordinator {
  /**
   * State a service last reported, from anywhere on the board. Undefined while
   * the owning runtime is still loading — boards restore their runtimes
   * concurrently — which callers retry rather than treat as a failure.
   */
  getServiceState(runtimeId: string, serviceUuid: string): unknown;

  /** A `__hkpMount` value as connection parts, resolving a reference on the way. */
  resolveMount(value: string | null | undefined): MountEndpoint | null;

  /** A `__hkpMount` value as an address: the owner's published URL for a
   *  reference, the value itself when it is already an address. */
  resolveMountUrl(value: string | null | undefined): string | null;

  /**
   * Every mount reference in a board document, replaced by the address it
   * currently resolves to. Used when exporting a board to a device that will
   * not have the runtime a reference names.
   */
  resolveMountsInBoard<T>(board: T): T;
}

export function createBoardCoordinator(
  readState: () => CoordinatorState,
): BoardCoordinator {
  const getServiceState = (runtimeId: string, serviceUuid: string): unknown =>
    readState().services[runtimeId]?.find((svc) => svc.uuid === serviceUuid)
      ?.state;

  const resolveMountUrl = (value: string | null | undefined): string | null => {
    const ref = parseMountRef(value);
    if (!ref) {
      return value ?? null;
    }
    const state = getServiceState(ref.runtimeId, ref.serviceUuid) as
      | Record<string, unknown>
      | null
      | undefined;
    const published = state?.[MOUNT_FIELD];
    return typeof published === "string" && published ? published : null;
  };

  return {
    getServiceState,
    resolveMountUrl,
    resolveMount: (value) => parseMountEndpoint(resolveMountUrl(value)),
    resolveMountsInBoard: (board) =>
      substituteMountsInBoard(board, resolveMountUrl),
  };
}
