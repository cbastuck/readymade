import { CoordinatorDescriptor } from "../../common";
import { getTemplateVarMap } from "../../templateVars";

/**
 * A link to a board somebody shared.
 *
 * It names three things and carries nothing else: the coordinator the board
 * is deployed on, its owner, and the board. It is not a credential — opening
 * it gets a person nowhere unless the board's member list names the address
 * they sign in with.
 *
 * Because it names a coordinator, it names somewhere this client would send
 * the person's sign-in. So a link is acted on only for a coordinator the
 * person already keeps; one naming any other host has to be agreed to first
 * (`isKnownCoordinator`). Otherwise a link would be a way to collect tokens:
 * anybody can write one pointing at a server of their own.
 */

export type SharedBoardLink = {
  /** The coordinator's base address, as a client keeps one. */
  coordinatorUrl: string;
  /** The owner's id, as the coordinator knows them. */
  owner: string;
  boardName: string;
};

/** Where the cloud view lives in every host that has one. */
const CLOUD_PATH = "/cloud-boards";

const PARAMS = {
  coordinator: "shared",
  owner: "owner",
  board: "board",
} as const;

function sameAddress(a: string, b: string): boolean {
  const key = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();
  return key(a) === key(b);
}

export function createSharedBoardLink(link: SharedBoardLink): string {
  const origin = getTemplateVarMap().HKP_WEBAPP_URL ?? window.location.origin;
  const query = new URLSearchParams({
    [PARAMS.coordinator]: link.coordinatorUrl,
    [PARAMS.owner]: link.owner,
    [PARAMS.board]: link.boardName,
  });
  return `${origin}${CLOUD_PATH}?${query.toString()}`;
}

/** The board a location's query names, or null when it names none. */
export function readSharedBoardLink(search: string): SharedBoardLink | null {
  const query = new URLSearchParams(search);
  const coordinatorUrl = query.get(PARAMS.coordinator);
  const owner = query.get(PARAMS.owner);
  const boardName = query.get(PARAMS.board);
  if (!coordinatorUrl || !owner || !boardName) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(coordinatorUrl);
  } catch {
    return null;
  }
  // Anything else is not somewhere a coordinator is reached.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  return { coordinatorUrl, owner, boardName };
}

/** The coordinator the person keeps at this address, if they keep one. */
export function findKnownCoordinator(
  coordinators: CoordinatorDescriptor[],
  coordinatorUrl: string,
): CoordinatorDescriptor | undefined {
  return coordinators.find((kept) => sameAddress(kept.url, coordinatorUrl));
}

/** A name for a coordinator nobody named: the host it is on. */
export function coordinatorNameFor(coordinatorUrl: string): string {
  try {
    return new URL(coordinatorUrl).host;
  } catch {
    return coordinatorUrl;
  }
}

/** The bridge endpoint of a coordinator, from its base address. */
export function bridgeUrlFor(coordinatorUrl: string): string {
  return (
    coordinatorUrl
      .replace(/^http(s?):\/\//, "ws$1://")
      .replace(/\/coordinator\/?$/, "") + "/coordinator/bridge"
  );
}
