import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppContext } from "../../AppContext";
import {
  CloudBoard,
  CloudBoardSummary,
  deleteCloudBoard,
  getCloudBoard,
  listCloudBoards,
  unshareCloudBoard,
  upsertCloudBoard,
} from "../../cloud/boardStorage";
import { getLocalBoard, localStoragePrefix } from "../playground/common";
import { BoardNode, FolderNode } from "./types";

/**
 * Start-page sources backed by the cloud board storage (api/boards.php),
 * shared by every host with a cloud login (website desktop + mobile, Readymade):
 * the "Shared" source (With me / From me), the virtual "Uploaded" folder for
 * My Boards, and the share-management / upload actions. Requires an
 * AppContext ancestor; everything degrades gracefully while logged out.
 */

// The board versions (cloud id → updatedAt) the user has last opened. A
// shared board whose cloud updatedAt differs gets the "Update available"
// badge until it is opened again.
const CLOUD_SEEN_KEY = "hkp-cloud-board-seen";

function readSeenVersions(): Record<string, string> {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CLOUD_SEEN_KEY) ?? "{}",
    ) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function markSeenVersion(id: string, updatedAt: string) {
  localStorage.setItem(
    CLOUD_SEEN_KEY,
    JSON.stringify({ ...readSeenVersions(), [id]: updatedAt }),
  );
}

/**
 * The board document inside a stored record.
 *
 * A record holds the board itself, but boards uploaded before that was true
 * hold the local-storage envelope ({source, createdAt, description}) instead —
 * unwrapped here rather than left to open as an empty board. The record's name
 * is what the finder lists the board under, so that is what the document is
 * named: a document disagreeing would open under one name and upload back
 * under another, as a second board.
 */
function boardDocument(board: CloudBoard): Record<string, unknown> {
  const data = board.data ?? {};
  const wrapped = typeof data.source === "string" ? data.source : null;
  if (wrapped) {
    try {
      return {
        ...(JSON.parse(wrapped) as Record<string, unknown>),
        boardName: board.name,
      };
    } catch {
      // Unparseable source: hand the record over as it is, so whatever else it
      // carries is still there to look at.
      return { ...data, boardName: board.name };
    }
  }
  return { ...data, boardName: board.name };
}

/**
 * The default board reader: the localStorage store the browser hosts save to.
 * Boards are stored there wrapped ({source, createdAt, description}); what
 * belongs in the cloud is the board inside, not the envelope around it.
 */
async function readLocalBoard(
  name: string,
): Promise<Record<string, unknown> | null> {
  return (getLocalBoard(name) as Record<string, unknown> | undefined) ?? null;
}

/** The description a locally saved board's envelope carries, if any. */
function localBoardDescription(name: string): string | undefined {
  const { description } = JSON.parse(
    localStorage.getItem(`${localStoragePrefix}${name}`) ?? "{}",
  ) as { description?: string };
  return description;
}

export interface CloudBoardSourcesOptions {
  /** Reads a saved board by name, for the upload action. Defaults to the
   *  localStorage board store, which is where the browser hosts keep boards;
   *  a host with storage of its own (the Readymade app's board files) passes
   *  its own reader. Resolving null means "no such board here". */
  loadBoard?: (name: string) => Promise<Record<string, unknown> | null>;
}

export interface CloudBoardSources {
  /** The "Shared" source folder (With me / From me). */
  sharedSource: FolderNode;
  /** The virtual "Uploaded" folder inside My Boards; empty while logged out. */
  uploadedFolders: FolderNode[];
  /** Sends a locally saved board to the cloud storage; undefined logged out. */
  uploadBoardToCloud?: (name: string) => Promise<void>;
  onRevokeShare: (board: BoardNode, email: string) => Promise<void>;
  onLeaveShare: (board: BoardNode) => Promise<void>;
  /** Deletes one of the user's uploaded boards from the cloud storage, with
   *  the shares that go with it. The local copy, if any, is untouched. */
  onDeleteCloudBoard: (board: BoardNode) => Promise<void>;
  /** Fetches a cloud-stored board and marks it seen (clearing the "New" /
   *  "Update available" badge); null while logged out. The host decides how
   *  to open the returned board (share-link encoding, direct descriptor, …). */
  openCloudStored: (action: {
    id: string;
    name: string;
  }) => Promise<CloudBoard | null>;
}

export function useCloudBoardSources(
  options: CloudBoardSourcesOptions = {},
): CloudBoardSources {
  const { loadBoard } = options;
  const { user } = useAppContext();
  const [cloudBoards, setCloudBoards] = useState<CloudBoardSummary[]>([]);

  const refreshCloudBoards = useCallback(async () => {
    if (!user) {
      setCloudBoards([]);
      return;
    }
    try {
      setCloudBoards(await listCloudBoards({ idToken: user.idToken }));
    } catch {
      setCloudBoards([]);
    }
  }, [user]);

  useEffect(() => {
    void refreshCloudBoards();
  }, [refreshCloudBoards]);

  // Sends a locally saved board to the user's cloud boards (api/boards.php);
  // logged out, the details view simply doesn't offer the upload.
  const uploadBoardToCloud = useMemo(
    () =>
      user
        ? async (name: string) => {
            const board = await (loadBoard ?? readLocalBoard)(name);
            if (!board) {
              throw new Error("Board not found on this device");
            }
            // The local store keeps the description in the envelope around
            // the board; a host with a store of its own has it on the
            // document itself.
            let description: string | undefined;
            if (loadBoard) {
              description =
                typeof board.description === "string"
                  ? board.description
                  : undefined;
            } else {
              description = localBoardDescription(name);
            }
            await upsertCloudBoard(
              { idToken: user.idToken },
              {
                name,
                // Uploaded under the name it is filed as, so it opens under
                // that name and a re-upload updates this record rather than
                // creating a second one.
                data: { ...board, boardName: name },
                metadata: description ? { description } : undefined,
              },
            );
            // The board should show up under My Boards → Uploaded right away.
            await refreshCloudBoards();
          }
        : undefined,
    [user, loadBoard, refreshCloudBoards],
  );

  const sharedSource = useMemo<FolderNode>(() => {
    const seen = readSeenVersions();
    const toNode = (board: CloudBoardSummary): BoardNode => {
      // Owners published this version themselves; the badge is viewer-only.
      const isNew = board.role === "viewer" && !seen[board.id];
      const hasUpdate =
        board.role === "viewer" &&
        !isNew &&
        seen[board.id] !== board.updatedAt;
      return {
        type: "board",
        name: board.name,
        state: isNew || hasUpdate ? "unreviewed" : "shared",
        sub: isNew ? "New" : hasUpdate ? "Update available" : undefined,
        by: board.role === "viewer" ? (board.ownerEmail ?? undefined) : undefined,
        description:
          typeof board.metadata?.description === "string"
            ? board.metadata.description
            : undefined,
        action: { kind: "cloud-stored", id: board.id, name: board.name },
        cloudId: board.id,
        cloudRole: board.role,
        sharedWith: board.sharedWith ?? undefined,
      };
    };
    const withMe = cloudBoards
      .filter((board) => board.role === "viewer")
      .map(toNode);
    const fromMe = cloudBoards
      .filter(
        (board) =>
          board.role === "owner" && (board.sharedWith?.length ?? 0) > 0,
      )
      .map(toNode);
    return {
      type: "folder",
      name: "Shared",
      source: true,
      emptyHint: user ? "No shared boards yet" : "Log in to see shared boards",
      children: user
        ? [
            {
              type: "folder",
              name: "With me",
              children: withMe,
              emptyHint: "Nothing shared with you yet",
            },
            {
              type: "folder",
              name: "From me",
              children: fromMe,
              emptyHint: "You are not sharing any boards",
            },
          ]
        : [],
    };
  }, [cloudBoards, user]);

  // Virtual "Uploaded" folder inside My Boards: every board the user has in
  // the cloud storage, whether shared or not. Hidden while logged out.
  const uploadedFolders = useMemo<FolderNode[]>(() => {
    if (!user) {
      return [];
    }
    const uploaded = cloudBoards
      .filter((board) => board.role === "owner")
      .map<BoardNode>((board) => ({
        type: "board",
        name: board.name,
        state: "saved",
        sub: "In cloud",
        description:
          typeof board.metadata?.description === "string"
            ? board.metadata.description
            : undefined,
        action: { kind: "cloud-stored", id: board.id, name: board.name },
        cloudId: board.id,
        cloudRole: board.role,
        sharedWith: board.sharedWith ?? undefined,
      }));
    return [
      {
        type: "folder",
        name: "Uploaded",
        children: uploaded,
        emptyHint: "No boards uploaded yet",
      },
    ];
  }, [cloudBoards, user]);

  const onRevokeShare = useCallback(
    async (board: BoardNode, email: string) => {
      if (!user || !board.cloudId) {
        return;
      }
      await unshareCloudBoard({ idToken: user.idToken }, board.cloudId, email);
      await refreshCloudBoards();
    },
    [user, refreshCloudBoards],
  );

  const onLeaveShare = useCallback(
    async (board: BoardNode) => {
      if (!user || !board.cloudId) {
        return;
      }
      if (!user.email) {
        throw new Error("This account has no email to match the share");
      }
      await unshareCloudBoard(
        { idToken: user.idToken },
        board.cloudId,
        user.email.toLowerCase(),
      );
      await refreshCloudBoards();
    },
    [user, refreshCloudBoards],
  );

  const onDeleteCloudBoard = useCallback(
    async (board: BoardNode) => {
      if (!user || !board.cloudId) {
        return;
      }
      await deleteCloudBoard({ idToken: user.idToken }, board.cloudId);
      await refreshCloudBoards();
    },
    [user, refreshCloudBoards],
  );

  const openCloudStored = useCallback(
    async (action: { id: string; name: string }): Promise<CloudBoard | null> => {
      if (!user) {
        return null;
      }
      const board = await getCloudBoard({ idToken: user.idToken }, action.id);
      // Opening clears the "New" / "Update available" badge.
      markSeenVersion(action.id, board.updatedAt);
      return { ...board, data: boardDocument(board) };
    },
    [user],
  );

  return {
    sharedSource,
    uploadedFolders,
    uploadBoardToCloud,
    onRevokeShare,
    onLeaveShare,
    onDeleteCloudBoard,
    openCloudStored,
  };
}
