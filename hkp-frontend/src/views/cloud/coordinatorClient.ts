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
  // Built through Headers rather than as an object literal so that header names
  // are matched case-insensitively: "Content-Type" and "content-type" are two
  // distinct keys in an object, and Headers would combine them into
  // "application/json, application/json" — which express.json() does not match,
  // so the body would arrive unparsed and the request read as malformed.
  const headers = new Headers({ "Content-Type": "application/json" });
  new Headers(options.headers).forEach((value, name) =>
    headers.set(name, value),
  );
  headers.set("Authorization", `Bearer ${idToken}`);

  return fetch(url, { ...options, headers });
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
 * Asks a coordinator for a ticket per runtime of a board.
 *
 * A ticket is what a runtime server connects to the coordinator with, and all
 * it is told about the board: it speaks for one runtime of one board of this
 * person. For a board that is already deployed they are pending beside the
 * tickets its runtime servers hold, until the board is registered again; see
 * `cancelCoordinatorTickets` for a deploy that does not get that far. The
 * tickets are shown once, here — the coordinator keeps only what recognises
 * them — so they
 * go straight to the runtime servers they are for and nowhere else.
 */
export async function requestCoordinatorTickets(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  boardName: string,
  runtimeIds: string[],
): Promise<Record<string, string>> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards/${encodeURIComponent(boardName)}/tickets`,
    idToken,
    { method: "POST", body: JSON.stringify({ runtimeIds }) },
  );
  if (res.status === 404 || res.status === 405) {
    throw new Error(
      "This coordinator cannot take runtime servers connecting to it — it needs updating",
    );
  }
  if (!res.ok) {
    throw new Error(`Failed to prepare the board: ${res.status}`);
  }
  const data = (await res.json()) as { tickets?: Record<string, string> };
  return data.tickets ?? {};
}

/**
 * Takes back the tickets of a deploy that did not go through, so that it
 * changes nothing: a runtime server left waiting with one is let go, and the
 * board's own servers and tickets stay as they were.
 *
 * Never throws. It is called while reporting a failure, which must not be
 * replaced by a second one; what it could not take back, the next deploy
 * replaces.
 */
export async function cancelCoordinatorTickets(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  boardName: string,
): Promise<void> {
  try {
    await coordinatorFetch(
      `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards/${encodeURIComponent(boardName)}/tickets`,
      idToken,
      { method: "DELETE" },
    );
  } catch (err) {
    console.warn("Could not take back the tickets of a failed deploy", err);
  }
}

export type CoordinatorParticipant = {
  runtimeId: string;
  /** Whether the runtime server holding this runtime's ticket is connected. */
  connected: boolean;
  /** "node", "python", "c++" — as that server names itself; while connected. */
  server?: string;
  issuedAt: string;
};

/** Which of a board's runtimes hold a ticket, and which are connected. */
export async function listCoordinatorParticipants(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  boardName: string,
): Promise<CoordinatorParticipant[]> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards/${encodeURIComponent(boardName)}/participants`,
    idToken,
  );
  if (!res.ok) {
    throw new Error(`Failed to list participants: ${res.status}`);
  }
  const data = (await res.json()) as { participants?: CoordinatorParticipant[] };
  return data.participants ?? [];
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

/**
 * Turn logging on or off for a deployed board.
 *
 * Applied to the runtimes that are already running and remembered on the board,
 * so it neither restarts anything nor quietly reverts on the next start.
 * Reports the runtimes that did not take it rather than assuming they all did.
 */
export async function setCoordinatorBoardLogging(
  coordinatorUrl: string,
  username: string,
  idToken: string,
  boardName: string,
  enabled: boolean,
  level: "debug" | "info" | "warn" | "error" = "info",
): Promise<{ logging: boolean; level: string; unreachable: string[] }> {
  const res = await coordinatorFetch(
    `${coordinatorUrl}/users/${encodeURIComponent(username)}/boards/${encodeURIComponent(boardName)}/logging`,
    idToken,
    // No Content-Type here: coordinatorFetch sets it. Setting it again under a
    // different capitalisation makes two keys in the object literal, which
    // Headers combines into "application/json, application/json" — a value
    // express.json() does not match, so the body arrives unparsed.
    { method: "POST", body: JSON.stringify({ enabled, level }) },
  );
  if (!res.ok) {
    throw new Error(`Failed to change logging: ${res.status}`);
  }
  return res.json() as Promise<{
    logging: boolean;
    level: string;
    unreachable: string[];
  }>;
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
