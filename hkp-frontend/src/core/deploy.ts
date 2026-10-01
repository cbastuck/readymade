import { BoardDescriptor, RuntimeClass } from "../types";
import { CoordinatorDescriptor } from "../common";
import {
  registerCoordinatorBoard,
  requestCoordinatorTickets,
} from "../views/cloud/coordinatorClient";
import {
  introduceRuntimeServer,
  secretsFor,
} from "../runtime/rest/RuntimeRestApi";
import {
  DeployPreflightError,
  RuntimePreflight,
  blocksDeploy,
  preflightBoard,
} from "./deployPreflight";

/**
 * Deploying a board: handing it to a coordinator that will own it.
 *
 * A board is built in a browser, which provisions its runtimes and takes them
 * with it when it closes. Deploying registers the board with a coordinator,
 * which builds the same runtimes itself and keeps them running with nobody
 * watching — after which this browser attaches to the board rather than owning
 * it.
 *
 * The coordinator dials nothing. Every runtime server the board uses connects
 * *to it*, so deploying is an **introduction**, and this browser is the only
 * party that can make it: it holds the person's session with the coordinator
 * and with each of their runtime servers. It asks the coordinator for a ticket
 * per runtime and tells each runtime server to connect with it. Only once they
 * all have is the board handed over.
 */

export type DeployableBoard = {
  boardName?: string;
  serializeBoard: () => Promise<BoardDescriptor | null>;
  handOverRuntimes: () => void;
  /** The runtime servers this client keeps; what a board's `remote` and
   *  `requires` are resolved against. */
  availableRuntimeEngines?: Array<RuntimeClass>;
};

export type DeployResult = {
  boardName: string;
  /** What the coordinator made of the board. "error" is a board it now owns
   *  and could not fully start — handed over, not running. */
  status: "running" | "stopped" | "error";
  errors: string[];
  /** Where each runtime was placed; names the remote chosen for a requirement. */
  placements: RuntimePreflight[];
};

/** A runtime server would not connect to the coordinator; nothing was handed
 *  over, and this browser still owns the board. */
export class DeployIntroductionError extends Error {
  constructor(
    readonly runtimeId: string,
    message: string,
  ) {
    super(message);
    this.name = "DeployIntroductionError";
  }
}

/** What to tell a person about a board that has just been handed over. */
export function describeDeploy(
  result: DeployResult,
  coordinatorName: string,
): { ok: boolean; message: string } {
  if (result.status === "error") {
    const reasons = result.errors.join("; ");
    return {
      ok: false,
      message:
        `“${result.boardName}” was handed to ${coordinatorName} but did not fully start` +
        (reasons ? ` — ${reasons}` : ""),
    };
  }
  // Where a requirement landed is this client's choice, so it is said.
  const chosen = result.placements
    .filter((placement) => placement.mode === "requires" && placement.remoteName)
    .map((placement) => `“${placement.name}” on “${placement.remoteName}”`);
  return {
    ok: true,
    message:
      `“${result.boardName}” is running on ${coordinatorName}` +
      (chosen.length ? ` — ${chosen.join(", ")}` : ""),
  };
}

/**
 * What deploying this board would find, without deploying it: per runtime,
 * where it would run and whether it could.
 *
 * For showing a person before they decide. `deployBoard` asks again for itself
 * — the answer may have changed by the time they press the button, and it is
 * the one that must not act on a stale one.
 */
export async function checkDeploy(
  board: DeployableBoard,
  user: { userId: string; idToken: string },
): Promise<RuntimePreflight[]> {
  const serialized = await board.serializeBoard();
  if (!serialized) {
    throw new Error("Could not serialize the current board");
  }
  return preflightBoard(serialized, board.availableRuntimeEngines ?? [], user);
}

export async function deployBoard(
  board: DeployableBoard,
  coordinator: CoordinatorDescriptor,
  user: { userId: string; idToken: string },
): Promise<DeployResult> {
  const serialized = await board.serializeBoard();
  if (!serialized) {
    throw new Error("Could not serialize the current board");
  }
  const boardName =
    board.boardName || serialized.boardName || "Untitled board";

  // Before anything is given up: past the handover below a problem can only be
  // reported, not avoided, and this browser is still the owner until then.
  const placements = await preflightBoard(
    serialized,
    board.availableRuntimeEngines ?? [],
    user,
  );
  if (placements.some(blocksDeploy)) {
    throw new DeployPreflightError(placements);
  }

  // The introduction. Still before the handover, and for the same reason: a
  // runtime server that cannot connect is a board that would not start.
  const participants = placements.filter(
    (placement) => placement.status === "ready" && !!placement.url,
  );
  if (participants.length > 0) {
    const tickets = await requestCoordinatorTickets(
      coordinator.url,
      user.userId,
      user.idToken,
      boardName,
      participants.map((placement) => placement.runtimeId),
    );
    // The values each runtime's services reference, gathered one runtime at a
    // time: releasing them may ask the person, and two questions at once is
    // one too many. Consent is asked for the server the name resolved to,
    // never for the name — a name is the board's to choose and resolves
    // differently for everyone, so a grant keyed on it would follow the board
    // wherever it pointed.
    const secrets = new Map<string, Awaited<ReturnType<typeof secretsFor>>>();
    for (const placement of participants) {
      secrets.set(
        placement.runtimeId,
        await secretsFor(serialized.services[placement.runtimeId], {
          boardName,
          runtimeId: placement.runtimeId,
          runtimeName: placement.name,
          url: placement.url!,
        }),
      );
    }

    await Promise.all(
      participants.map(async (placement) => {
        const ticket = tickets[placement.runtimeId];
        try {
          if (!ticket) {
            throw new Error("the coordinator issued no ticket for it");
          }
          await introduceRuntimeServer(placement.url!, user, {
            coordinatorUrl: coordinator.url,
            ticket,
            boardName,
            runtimeId: placement.runtimeId,
            secrets: secrets.get(placement.runtimeId),
          });
        } catch (err) {
          throw new DeployIntroductionError(
            placement.runtimeId,
            `“${placement.name || placement.runtimeId}”: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );
  }

  // Before registering, not after: the coordinator builds the runtimes under
  // the ids this board already uses, so from the first moment of the handover
  // they are no longer this browser's to delete. Doing it afterwards would
  // leave a window in which navigating away deletes the board that was just
  // deployed.
  board.handOverRuntimes();

  const info = await registerCoordinatorBoard(
    coordinator.url,
    user.userId,
    user.idToken,
    { ...serialized, boardName },
  );
  return {
    boardName,
    status: info?.status ?? "running",
    errors: info?.errors ?? [],
    placements,
  };
}
