import { BoardDescriptor, RuntimeClass } from "../types";
import { CoordinatorDescriptor } from "../common";
import {
  cancelCoordinatorTickets,
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
 * it. What this browser built stays its own until it leaves: a board's
 * runtimes are kept apart from it on a runtime server, under the same ids.
 *
 * The coordinator dials nothing. Every runtime server the board uses connects
 * *to it*, so deploying is an **introduction**, and this browser is the only
 * party that can make it: it holds the person's session with the coordinator
 * and with each of their runtime servers. It asks the coordinator for a ticket
 * per runtime and tells each runtime server to connect with it. Only once they
 * all have is the board registered.
 */

export type DeployableBoard = {
  boardName?: string;
  serializeBoard: () => Promise<BoardDescriptor | null>;
  /** The runtime servers this client keeps; what a board's `remote` is
   *  resolved against. */
  availableRuntimeEngines?: Array<RuntimeClass>;
};

export type DeployResult = {
  boardName: string;
  /** What the coordinator made of the board. "error" is a board it now owns
   *  and could not fully start — handed over, not running. */
  status: "running" | "stopped" | "error";
  errors: string[];
  /** Where each runtime was placed. */
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
  return {
    ok: true,
    message: `“${result.boardName}” is running on ${coordinatorName}`,
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
  const boardName = board.boardName || serialized.boardName || "Untitled board";

  // Before anything is asked of the coordinator: past registering a problem
  // can only be reported, not avoided.
  const placements = await preflightBoard(
    serialized,
    board.availableRuntimeEngines ?? [],
    user,
  );
  if (placements.some(blocksDeploy)) {
    throw new DeployPreflightError(placements);
  }

  // The introduction. Still before registering, and for the same reason: a
  // runtime server that cannot connect is a board that would not start.
  const participants = placements.filter(
    (placement) => placement.status === "ready" && !!placement.url,
  );
  // The values each runtime's services reference, gathered one runtime at a
  // time: releasing them may ask the person, and two questions at once is
  // one too many. Consent is asked for the server the name resolved to,
  // never for the name — a name is the board's to choose and resolves
  // differently for everyone, so a grant keyed on it would follow the board
  // wherever it pointed. Asked before any ticket exists: a person saying no
  // leaves nothing to take back.
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

  // From the first ticket to the board being registered, a failure is taken
  // back: the tickets asked for are given up, so a runtime server left
  // waiting with one is let go and a board that was already running keeps the
  // servers and tickets it had. A deploy either goes through or changes
  // nothing.
  try {
    if (participants.length > 0) {
      const tickets = await requestCoordinatorTickets(
        coordinator.url,
        user.userId,
        user.idToken,
        boardName,
        participants.map((placement) => placement.runtimeId),
      );
      // Every introduction is waited for, also once one has failed: one still
      // on its way must not arrive after the tickets were taken back.
      const introduced = await Promise.allSettled(
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
      const failed = introduced.find((result) => result.status === "rejected");
      if (failed) {
        throw (failed as PromiseRejectedResult).reason;
      }
    }

    // The runtimes this browser built stay its own, and go when it leaves:
    // what the coordinator builds for the board is the board's, apart from
    // them even on the same server and under the same ids.
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
  } catch (err) {
    if (participants.length > 0) {
      await cancelCoordinatorTickets(
        coordinator.url,
        user.userId,
        user.idToken,
        boardName,
      );
    }
    throw err;
  }
}
