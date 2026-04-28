import { useEffect, useState } from "react";
import { ArrowRight, Folder, Plus, RotateCcw } from "lucide-react";

import { BoardDescriptor } from "hkp-frontend/src/types";

import { DEMO_BOARDS, DemoEntry } from "./demoBoards";
import { getBackend } from "./backend";
import LoadBoardDialog from "./LoadBoardDialog";
import MeanderHeader from "./MeanderHeader";

type Props = {
  onRestoreBoard: (board: BoardDescriptor | null | undefined) => void;
};
export default function StartPage({ onRestoreBoard }: Props) {
  const [lastSessionName, setLastSessionName] = useState<string | null>(null);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem("lastActiveBoardName");
    if (name) {
      setLastSessionName(name);
    }
  }, []);

  const handleResume = async () => {
    if (!lastSessionName) {
      return;
    }
    const backend = await getBackend();
    const history = await backend.loadBoardHistory(lastSessionName);
    if (history.length > 0) {
      onRestoreBoard(history[0].snapshot);
      return;
    }
    // Fall back to saved board file.
    try {
      const board = await backend.loadBoard(lastSessionName);
      onRestoreBoard(board);
    } catch {
      onRestoreBoard(null);
    }
  };

  const handleSelect = (board: BoardDescriptor) => {
    onRestoreBoard(board);
  };

  const handleBoardLoaded = (board: BoardDescriptor) => {
    onRestoreBoard(board);
  };

  const handleNewBoard = () => {
    onRestoreBoard(undefined);
  };

  const onOpenLoadDialog = () => setIsLoadDialogOpen(true);
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <MeanderHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Your Boards
          </h1>
          <div className="flex gap-2">
            {lastSessionName && (
              <button
                onClick={handleResume}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left w-full"
              >
                <RotateCcw
                  size={15}
                  className="text-muted-foreground shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground truncate">
                    Resume last session
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {lastSessionName}
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground shrink-0"
                />
              </button>
            )}
            <button
              onClick={handleNewBoard}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left w-full"
            >
              <Plus size={15} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">
                  Create new Board
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-muted-foreground shrink-0"
              />
            </button>

            <button
              onClick={onOpenLoadDialog}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left w-full"
            >
              <Folder size={15} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">
                  Load a Board
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-muted-foreground shrink-0"
              />
            </button>
          </div>

          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Launch a demo
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
              gap: 10,
            }}
          >
            {DEMO_BOARDS.map((entry) => (
              <DemoCard
                key={entry.label}
                entry={entry}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </div>

      <LoadBoardDialog
        visible={isLoadDialogOpen}
        onSetVisible={setIsLoadDialogOpen}
        onBoardLoaded={handleBoardLoaded}
      />
    </div>
  );
}

function DemoCard({
  entry,
  onSelect,
}: {
  entry: DemoEntry;
  onSelect: (board: BoardDescriptor) => void;
}) {
  return (
    <button
      onClick={() => onSelect(entry.board)}
      className="flex flex-col items-start gap-2 p-4 rounded-lg border border-border bg-card text-left cursor-pointer transition-colors hover:bg-accent hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span style={{ fontSize: 24 }}>{entry.icon}</span>
      <span
        className="text-[13px] font-semibold text-foreground leading-tight"
        style={{ fontFamily: "'Recursive', monospace" }}
      >
        {entry.label}
      </span>
      <span className="text-[11px] text-muted-foreground leading-snug">
        {entry.description}
      </span>
    </button>
  );
}
