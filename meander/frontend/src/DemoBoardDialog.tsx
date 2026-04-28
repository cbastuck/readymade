import { useContext } from "react";
import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { BoardDescriptor } from "hkp-frontend/src/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import { DEMO_BOARDS } from "./demoBoards";

type DemoBoardDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function DemoBoardDialog({
  isOpen,
  onClose,
}: DemoBoardDialogProps) {
  const boardContext = useContext(BoardCtx);

  const handleSelect = (board: BoardDescriptor) => {
    boardContext?.setBoardState(board);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw]">
        <DialogHeader>
          <DialogTitle>Demo Boards</DialogTitle>
        </DialogHeader>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            paddingTop: 4,
            overflowY: "auto",
            maxHeight: "65vh",
          }}
        >
          {DEMO_BOARDS.map((entry) => (
            <button
              key={entry.label}
              onClick={() => handleSelect(entry.board)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: "20px 16px",
                margin: "4px",
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "hsl(var(--accent))";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "hsl(var(--primary))";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "hsl(var(--card))";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "hsl(var(--border))";
              }}
            >
              <span style={{ fontSize: 28 }}>{entry.icon}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  fontFamily: "'Recursive', monospace",
                }}
              >
                {entry.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "hsl(var(--muted-foreground))",
                  lineHeight: 1.4,
                }}
              >
                {entry.description}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
