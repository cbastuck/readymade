import { useEffect, useMemo, useState } from "react";
import { browserDraftStore, DraftSummary } from "../../core/boardDrafts";
import { localBoardSavedAt } from "../playground/common";
import { BoardNode, FolderNode } from "./types";

/**
 * The "Unsaved" source: boards this browser kept from sketches nobody saved,
 * or changed since they were (core/boardDrafts).
 *
 * The way back to a draft: a draft lives under the address it was sketched at,
 * and opening the playground without one makes a new address every time. A
 * row opens the way a saved board does — at its address — where the playground
 * restores the draft.
 *
 * Null while there are none, so a host shows no empty folder.
 */
export function useDraftsSource(): FolderNode | null {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  useEffect(() => {
    let current = true;
    const read = () => {
      void browserDraftStore()
        .list()
        .then((list) => {
          if (current) {
            setDrafts(list);
          }
        });
    };
    read();
    // A board sketched in another tab while this one waited in the background.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        read();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return useMemo(() => {
    const children = drafts.flatMap<BoardNode>(({ boardName, updatedAt }) => {
      const savedAt = localBoardSavedAt(boardName);
      // A save newer than the draft is the board; the draft is what it was.
      if (savedAt !== undefined && Date.parse(updatedAt) <= savedAt) {
        return [];
      }
      return [
        {
          type: "board",
          name: boardName,
          state: "unsaved",
          sub: savedAt === undefined ? "Never saved" : "Unsaved changes",
          modified: updatedAt,
          action: { kind: "saved", name: boardName },
        },
      ];
    });
    return children.length
      ? { type: "folder", name: "Unsaved", children }
      : null;
  }, [drafts]);
}
