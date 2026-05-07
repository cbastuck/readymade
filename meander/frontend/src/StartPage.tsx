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
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        fontFamily: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif",
        color: "#0f172a",
      }}
    >
      <MeanderHeader />
      <div
        className="flex-1 overflow-y-auto px-6 py-8 md:px-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, #f5f7ff 0%, #ffffff 45%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        }}
      >
        <div
          className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white/90 shadow-2xl shadow-slate-200/60"
          style={{ backdropFilter: "blur(8px)" }}
        >
          {/* Your Boards */}
          <div className="border-b border-slate-200 px-8 py-6">
            <p
              className="uppercase tracking-[0.2em] text-slate-500 mb-5"
              style={{ fontSize: "0.72rem", fontWeight: 600 }}
            >
              Your Boards
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {lastSessionName && (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left flex-1"
                >
                  <RotateCcw size={15} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="uppercase tracking-[0.12em] text-slate-400 truncate"
                      style={{ fontSize: "0.68rem" }}
                    >
                      Resume last session
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
                      {lastSessionName}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 shrink-0" />
                </button>
              )}
              <button
                onClick={handleNewBoard}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left flex-1"
              >
                <Plus size={15} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div
                    className="uppercase tracking-[0.12em] text-slate-400"
                    style={{ fontSize: "0.68rem" }}
                  >
                    Create new
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    New Board
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
              </button>
              <button
                onClick={onOpenLoadDialog}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left flex-1"
              >
                <Folder size={15} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div
                    className="uppercase tracking-[0.12em] text-slate-400"
                    style={{ fontSize: "0.68rem" }}
                  >
                    Open file
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    Load Board
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Launch a demo */}
          <div className="px-8 py-6">
            <p
              className="uppercase tracking-[0.2em] text-slate-500 mb-5"
              style={{ fontSize: "0.72rem", fontWeight: 600 }}
            >
              Launch a Demo
            </p>
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
      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-slate-200 bg-white text-left cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <span style={{ fontSize: 24 }}>{entry.icon}</span>
      <span
        className="text-[13px] font-semibold text-slate-800 leading-tight"
        style={{ fontFamily: "'Recursive', monospace" }}
      >
        {entry.label}
      </span>
      <span className="text-[11px] text-slate-500 leading-snug">
        {entry.description}
      </span>
    </button>
  );
}
