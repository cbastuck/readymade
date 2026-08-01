import { BoardDescriptor } from "../../types";

export type CoordinatorBoardInfo = {
  boardName: string;
  /** "stopped" is a board the coordinator still holds but no longer runs — its
   *  config is kept, so deploying it again starts it back up. */
  status: "running" | "stopped" | "error";
  createdAt: string;
  config: BoardDescriptor;
  /** Reasons the session failed to come up cleanly (e.g. a runtime that could
   *  not be provisioned). Present when status is "error". */
  errors?: string[];
};

async function coordinatorFetch(
  url: string,
  idToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${idToken}`,
    },
  });
}

export async function listCoordinatorBoards(
  coordinatorUrl: string,
  username: string,
  idToken: string,
): Promise<CoordinatorBoardInfo[]> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards`,
    idToken,
  );
  if (!res.ok) {
    throw new Error(`Failed to list boards: ${res.status}`);
  }
  const data = (await res.json()) as { boards: CoordinatorBoardInfo[] };
  return data.boards;
}

export async function registerCoordinatorBoard(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  board: BoardDescriptor,
): Promise<CoordinatorBoardInfo> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards`,
    idToken,
    { method: "POST", body: JSON.stringify(board) },
  );
  if (!res.ok) {
    throw new Error(`Failed to register board: ${res.status}`);
  }
  return res.json() as Promise<CoordinatorBoardInfo>;
}

/**
 * Stops a board's runtimes without giving up the board.
 *
 * It keeps its place and its config — a coordinator's boards live only in its
 * memory, so stopping one must not be able to lose it. Deploying the board
 * again is what provisions and runs it.
 */
export async function stopCoordinatorBoard(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  boardName: string,
): Promise<CoordinatorBoardInfo> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards/${encodeURIComponent(boardName)}/stop`,
    idToken,
    { method: "POST" },
  );
  if (!res.ok) {
    throw new Error(`Failed to stop board: ${res.status}`);
  }
  return res.json() as Promise<CoordinatorBoardInfo>;
}

export async function deleteCoordinatorBoard(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  boardName: string,
): Promise<void> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards/${encodeURIComponent(boardName)}`,
    idToken,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete board: ${res.status}`);
  }
}
