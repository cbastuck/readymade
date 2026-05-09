import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import { useContext, useEffect, useState } from "react";
import { Clock, Trash } from "lucide-react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { BoardDescriptor } from "hkp-frontend/src/types";

import { deleteBoard, loadBoard } from "./actions";
import { getBackend } from "./backend";
import { HistoryBoardSummary } from "./backend/types";
import Button from "hkp-frontend/src/ui-components/Button";

type Props = {
  visible: boolean;
  onSetVisible: (visible: boolean) => void;
  onBoardLoaded?: (board: BoardDescriptor) => void;
};

type BoardEntry = {
  name: string;
  isSaved: boolean;
  latestTimestamp?: string;
};

function formatTimestamp(iso?: string): string {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function LoadBoardDialog({
  visible,
  onSetVisible,
  onBoardLoaded,
}: Props) {
  const boardContext = useContext(BoardCtx);
  const [entries, setEntries] = useState<Array<BoardEntry>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoading(true);
    (async () => {
      const backend = await getBackend();
      const [saved, histories] = await Promise.all([
        backend.fetchSavedBoards().catch(() => [] as string[]),
        backend.fetchHistoryBoards().catch(() => [] as HistoryBoardSummary[]),
      ]);
      const savedSet = new Set(saved);
      const merged: Array<BoardEntry> = [
        ...saved.map((name) => ({ name, isSaved: true })),
        ...histories
          .filter((h) => !savedSet.has(h.name))
          .map((h) => ({
            name: h.name,
            isSaved: false,
            latestTimestamp: h.latestTimestamp,
          })),
      ];
      merged.sort((a, b) => a.name.localeCompare(b.name));
      setEntries(merged);
      setLoading(false);
    })();
  }, [visible]);

  const refresh = async () => {
    const backend = await getBackend();
    const [saved, histories] = await Promise.all([
      backend.fetchSavedBoards().catch(() => [] as string[]),
      backend.fetchHistoryBoards().catch(() => [] as HistoryBoardSummary[]),
    ]);
    const savedSet = new Set(saved);
    const merged: Array<BoardEntry> = [
      ...saved.map((name) => ({ name, isSaved: true })),
      ...histories
        .filter((h) => !savedSet.has(h.name))
        .map((h) => ({
          name: h.name,
          isSaved: false,
          latestTimestamp: h.latestTimestamp,
        })),
    ];
    merged.sort((a, b) => a.name.localeCompare(b.name));
    setEntries(merged);
  };

  const onLoad = async (entry: BoardEntry) => {
    let board: BoardDescriptor;
    if (entry.isSaved) {
      board = await loadBoard(entry.name);
    } else {
      const history = await (await getBackend()).loadBoardHistory(entry.name);
      if (history.length === 0) return;
      board = history[0].snapshot;
    }
    boardContext?.setBoardState(board);
    onSetVisible(false);
    onBoardLoaded?.(board);
  };

  const onDelete = async (e: React.MouseEvent, entry: BoardEntry) => {
    e.stopPropagation();
    if (entry.isSaved) {
      await deleteBoard(entry.name);
    } else {
      await (await getBackend()).clearBoardHistory(entry.name);
    }
    refresh();
  };

  const avoidDefaultDomBehavior = (e: Event) => e.preventDefault();

  const saved = entries.filter((e) => e.isSaved);
  const historyOnly = entries.filter((e) => !e.isSaved);

  const onOpenFilePicker = async () => {
    const backend = await getBackend();
    const path = await backend.pickFile({ filters: ["*.hkpp"] });
    if (!path) {
      return;
    }
    const boardContent = await backend.readFile(path);
    if (boardContent) {
      const board = JSON.parse(boardContent) as BoardDescriptor;
      boardContext?.setBoardState(board);
      onSetVisible(false);
      onBoardLoaded?.(board);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={onSetVisible}>
      <DialogContent
        className="sm:max-w-sm max-h-[70vh] flex flex-col gap-0 p-0"
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="font-semibold">Load Board</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pb-2">
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-400">Loading…</p>
          )}

          {!loading && entries.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">
              No saved boards found.
            </p>
          )}

          {!loading && saved.length > 0 && (
            <>
              {saved.map((entry) => (
                <Row
                  key={entry.name}
                  entry={entry}
                  onLoad={onLoad}
                  onDelete={onDelete}
                />
              ))}
            </>
          )}

          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="hkp-btn border rounded-md m-0  hover:bg-[var(--hkp-accent-dim)] hover:text-[var(--hkp-accent)]"
              onClick={onOpenFilePicker}
            >
              Locate on disk
            </Button>
          </div>
          {!loading && historyOnly.length > 0 && (
            <>
              <p className="px-4 py-1 text-xs font-medium text-amber-500 uppercase tracking-wide mt-2">
                History (unsaved)
              </p>
              {historyOnly.map((entry) => (
                <Row
                  key={entry.name}
                  entry={entry}
                  onLoad={onLoad}
                  onDelete={onDelete}
                />
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  entry,
  onLoad,
  onDelete,
}: {
  entry: BoardEntry;
  onLoad: (e: BoardEntry) => void;
  onDelete: (ev: React.MouseEvent, e: BoardEntry) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 cursor-pointer group"
      onClick={() => onLoad(entry)}
    >
      {!entry.isSaved && (
        <Clock className="shrink-0 text-amber-400" size={13} />
      )}
      <span
        className={`flex-1 text-base truncate ${entry.isSaved ? "" : "text-amber-700"}`}
      >
        {entry.name}
      </span>
      {entry.latestTimestamp && (
        <span className="text-xs text-gray-400 shrink-0">
          {formatTimestamp(entry.latestTimestamp)}
        </span>
      )}
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
        onClick={(e) => onDelete(e, entry)}
        title={entry.isSaved ? "Delete saved board" : "Clear history"}
      >
        <Trash size={13} />
      </button>
    </div>
  );
}
