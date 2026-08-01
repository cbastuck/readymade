import { BoardDescriptor } from "../types";
import { CoordinatorDescriptor } from "../common";
import { registerCoordinatorBoard } from "../views/cloud/coordinatorClient";

/**
 * Deploying a board: handing it to a coordinator that will own it.
 *
 * A board is built in a browser, which provisions its runtimes and takes them
 * with it when it closes. Deploying registers the board with a coordinator,
 * which provisions the same runtimes itself and keeps them running with nobody
 * watching — after which this browser attaches to the board rather than owning
 * it.
 */

export type DeployableBoard = {
  boardName?: string;
  serializeBoard: () => Promise<BoardDescriptor | null>;
  handOverRuntimes: () => void;
};

export async function deployBoard(
  board: DeployableBoard,
  coordinator: CoordinatorDescriptor,
  user: { userId: string; idToken: string },
): Promise<string> {
  const serialized = await board.serializeBoard();
  if (!serialized) {
    throw new Error("Could not serialize the current board");
  }
  const boardName =
    board.boardName || serialized.boardName || "Untitled board";

  // Before registering, not after: the coordinator provisions the runtimes
  // under the ids this board already uses, so from the first moment of the
  // handover they are no longer this browser's to delete. Doing it afterwards
  // would leave a window in which navigating away deletes the board that was
  // just deployed.
  board.handOverRuntimes();

  await registerCoordinatorBoard(
    coordinator.url,
    user.userId,
    user.idToken,
    { ...serialized, boardName },
  );
  return boardName;
}
