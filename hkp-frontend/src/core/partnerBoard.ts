import { BoardDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { createBoardLink } from "hkp-frontend/src/views/playground/BoardLink";
import {
  isLocalhostUrl,
  resolveTemplateVarsInObject,
} from "hkp-frontend/src/templateVars";

const PEER_SOCKET_SERVICE_ID = "hookup.to/service/peer-socket";

/** Whether a board has anything a partner board would be derived from. */
export function hasPeerService(services: {
  [runtimeId: string]: Array<ServiceDescriptor>;
}): boolean {
  return Object.values(services).some((svcs) =>
    svcs.some((svc) => svc.serviceId === PEER_SOCKET_SERVICE_ID),
  );
}

/**
 * Derives the board for the other side of a peer connection: the same board
 * with the peer roles reversed, so opening it connects back to this one.
 *
 * `resolveMounts` is the coordinator's mount resolution — it answers from its
 * own view of the whole board, so references still resolve after the trim.
 */
export function createPartnerBoard(
  board: BoardDescriptor,
  resolveMounts: <T>(board: T) => T,
): BoardDescriptor {
  // Exclude runtimes whose URL resolves to localhost — those are specific to
  // the originator's machine and will fail on the partner's. Runtimes at a
  // public or LAN address are kept because both parties can reach them.
  const partnerRuntimeIds = new Set(
    board.runtimes
      .filter((rt) => !isLocalhostUrl((rt as any).url))
      .map((rt) => rt.id),
  );
  const partnerRuntimes = board.runtimes.filter((rt) =>
    partnerRuntimeIds.has(rt.id),
  );

  // Swap peerName / targetPeer on peer-socket services so the partner board
  // connects back to the originator rather than to itself.
  const partnerServices: BoardDescriptor["services"] = {};
  for (const [runtimeId, svcs] of Object.entries(board.services)) {
    if (!partnerRuntimeIds.has(runtimeId)) {
      continue;
    }
    partnerServices[runtimeId] = svcs.map((svc) => {
      if (svc.serviceId !== PEER_SOCKET_SERVICE_ID) {
        return svc;
      }
      const { peerName, targetPeer, ...rest } = svc.state ?? {};
      return {
        ...svc,
        state: { ...rest, peerName: targetPeer, targetPeer: peerName },
      };
    });
  }

  // A mount reference typically names one of the very runtimes dropped above
  // (a peer server on the originator's local runtime), so the source of the
  // address is gone from the partner board by design — which is exactly why it
  // must be baked in. The coordinator resolves against the whole board.
  return resolveTemplateVarsInObject(
    resolveMounts({
      runtimes: partnerRuntimes,
      services: partnerServices,
      facade: board.facade,
    }),
  );
}

/**
 * The partner board as a link, or null when the board cannot be serialized.
 *
 * The one way in: both the toolbar's share menu and a facade's board action
 * hand out the same board, so neither derives it a second time.
 */
export async function createPartnerBoardLink(
  boardContext: BoardContextState,
): Promise<string | null> {
  const board = await boardContext.serializeBoard();
  if (!board) {
    return null;
  }
  return createBoardLink(
    JSON.stringify(
      createPartnerBoard(board, boardContext.coordinator.resolveMountsInBoard),
    ),
  );
}
