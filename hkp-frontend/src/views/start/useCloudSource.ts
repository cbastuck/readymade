import { useEffect, useMemo, useState } from "react";

import { useAppContext } from "../../AppContext";
import { restoreCoordinators } from "../../common";
import {
  CoordinatorBoardInfo,
  listCoordinatorBoards,
} from "../cloud/coordinatorClient";
import { BoardNode, FolderNode } from "./types";

function cloudBoardNode(
  coordinatorUrl: string,
  board: CoordinatorBoardInfo,
): BoardNode {
  return {
    type: "board",
    name: board.boardName,
    state: board.status === "running" ? "running" : "needs-input",
    sub: board.status === "running" ? "Running in cloud" : "Failed to start",
    action: { kind: "cloud", coordinatorUrl, boardName: board.boardName },
  };
}

/**
 * The Cloud source folder: boards registered on the user's coordinators.
 * Requires the shared cloud login; shows a hint instead of contents while
 * logged out.
 */
export function useCloudFolder(enabled: boolean): FolderNode {
  const { user } = useAppContext();
  const [children, setChildren] = useState<FolderNode["children"]>([]);

  useEffect(() => {
    if (!enabled || !user) {
      setChildren([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const coordinators = restoreCoordinators();
      const results = await Promise.all(
        coordinators.map(async (coordinator) => {
          try {
            const boards = await listCoordinatorBoards(
              coordinator.url,
              user.username,
              user.idToken,
            );
            return boards.map((board) => cloudBoardNode(coordinator.url, board));
          } catch {
            return [];
          }
        }),
      );
      if (!cancelled) {
        setChildren(results.flat());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  return useMemo<FolderNode>(
    () => ({
      type: "folder",
      name: "Cloud",
      source: true,
      children,
      emptyHint: user ? "No cloud boards yet" : "Log in to see your cloud boards",
    }),
    [children, user],
  );
}
