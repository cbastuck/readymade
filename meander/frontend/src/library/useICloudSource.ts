import { useCallback, useEffect, useMemo, useState } from "react";

import type { BoardNode, FolderNode } from "hkp-frontend/src/views/start";

import { getBackend } from "../backend";

/**
 * The start page's iCloud source on a Mac: the boards the Readymade iOS app
 * keeps in iCloud Drive, which iCloud Drive brings to this Mac as a folder.
 * Null where there is no such folder — iCloud Drive off, or no iPhone that
 * ever saved a board — so the source is simply not there.
 */
export function useICloudSource(): FolderNode | null {
  const [boards, setBoards] = useState<Array<{ name: string; modified?: string }> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const backend = await getBackend();
      setBoards((await backend.listSharedBoards?.()) ?? null);
    } catch {
      setBoards(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo<FolderNode | null>(() => {
    if (boards === null) {
      return null;
    }
    return {
      type: "folder",
      name: "iCloud",
      source: true,
      children: boards.map<BoardNode>((board) => ({
        type: "board",
        name: board.name,
        state: "saved",
        sub: "On iCloud Drive",
        modified: board.modified,
        action: { kind: "icloud", name: board.name },
      })),
      emptyHint: "No boards in Readymade's iCloud Drive folder yet",
      onRefresh: () => void refresh(),
      refreshing,
    };
  }, [boards, refresh, refreshing]);
}
