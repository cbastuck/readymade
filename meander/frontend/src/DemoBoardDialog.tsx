import { useContext } from "react";
import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { BoardDescriptor } from "hkp-frontend/src/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import asciiCamBoard from "../../../hkp-frontend/boards/ascii-cam-board.json";
import dropitappBoard from "../../../hkp-frontend/boards/dropitapp-board.json";
import gameOfLifeBoard from "../../../hkp-frontend/boards/game-of-life-board.json";
import linkDebuggerBoard from "../../../hkp-frontend/boards/link-debugger.json";
import noiseAlertBoard from "../../../hkp-frontend/boards/noise-alert-board.json";
import peerChatBoard from "../../../hkp-frontend/boards/peer-chat-board.json";
import relayBoard from "../../../hkp-frontend/boards/relay.json";

type DemoEntry = {
  label: string;
  description: string;
  icon: string;
  board: BoardDescriptor;
};

const DEMO_BOARDS: DemoEntry[] = [
  {
    label: "ASCII Cam",
    description: "Render your webcam as ASCII art in the browser",
    icon: "📷",
    board: asciiCamBoard as unknown as BoardDescriptor,
  },
  {
    label: "Drop It App",
    description: "Drag-and-drop file sharing pipeline",
    icon: "📂",
    board: dropitappBoard as unknown as BoardDescriptor,
  },
  {
    label: "Game of Life",
    description: "Conway's Game of Life running in the browser runtime",
    icon: "🧬",
    board: gameOfLifeBoard as unknown as BoardDescriptor,
  },
  {
    label: "Link Debugger",
    description: "Decompress and inspect board QR link contents",
    icon: "🔍",
    board: linkDebuggerBoard as unknown as BoardDescriptor,
  },
  {
    label: "Noise Alert",
    description: "Detect loud sounds and trigger alerts",
    icon: "🔔",
    board: noiseAlertBoard as unknown as BoardDescriptor,
  },
  {
    label: "Peer Chat",
    description: "Two-way chat between browser tabs via WebRTC",
    icon: "💬",
    board: peerChatBoard as unknown as BoardDescriptor,
  },
  {
    label: "Relay",
    description: "Bridge an HTTP relay endpoint into a browser pipeline",
    icon: "🔗",
    board: relayBoard as unknown as BoardDescriptor,
  },
];

type DemoBoardDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function DemoBoardDialog({ isOpen, onClose }: DemoBoardDialogProps) {
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
