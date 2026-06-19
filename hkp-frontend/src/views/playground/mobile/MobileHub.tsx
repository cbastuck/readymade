import { type TouchEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useBoardContext } from "../../../BoardContext";
import { BoardDescriptor, SavedBoard } from "../../../types";
import { getLocalBoard, getLocalBoards, removeLocalBoard } from "../common";
import { M } from "./tokens";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import ManageRuntimesSheet from "./ManageRuntimesSheet";
import ManageCoordinatorsSheet from "./ManageCoordinatorsSheet";

import liveLocationBoard from "../../../../boards/live-location-demo-board.json";
import microphoneSpeakerBoard from "../../../../boards/microphone-speaker-demo-board.json";

// ── Bundled demo boards (ready-to-run examples) ────────────────
type DemoEntry = {
  label: string;
  description: string;
  icon: string;
  board: BoardDescriptor;
};

const DEMO_BOARDS: DemoEntry[] = [
  {
    label: "Live Location",
    description:
      "Share your phone's live GPS position over a link — native Meander iOS only.",
    icon: "📍",
    board: liveLocationBoard as unknown as BoardDescriptor,
  },
  {
    label: "Microphone → Speaker",
    description:
      "Live mic-to-speaker audio passthrough — native Meander iOS only. Use headphones.",
    icon: "🎤",
    board: microphoneSpeakerBoard as unknown as BoardDescriptor,
  },
];

// ── Section header ─────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 4px 8px",
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: M.textMuted,
        }}
      >
        {title}
      </span>
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: M.textMuted,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── Saved board row (swipe left to reveal delete) ──────────────
const ROW_ACTION_WIDTH = 84;

function SavedBoardRow({
  board,
  onOpen,
  onDelete,
}: {
  board: SavedBoard;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const date = board.createdAt ? new Date(board.createdAt) : null;
  const dateLabel =
    date && !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
  const subtitle = board.description?.trim() || dateLabel;

  // Horizontal swipe-to-reveal. `dx` is the foreground offset (0…-ACTION_WIDTH).
  const [dx, setDx] = useState(0);
  const startXRef = useRef(0);
  const baseRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  const onTouchStart = (e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    baseRef.current = dx;
    draggingRef.current = true;
    movedRef.current = false;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!draggingRef.current) {
      return;
    }
    const delta = e.touches[0].clientX - startXRef.current;
    if (Math.abs(delta) > 6) {
      movedRef.current = true;
    }
    const next = Math.max(-ROW_ACTION_WIDTH, Math.min(0, baseRef.current + delta));
    setDx(next);
  };
  const onTouchEnd = () => {
    draggingRef.current = false;
    setDx((prev) => (prev < -ROW_ACTION_WIDTH / 2 ? -ROW_ACTION_WIDTH : 0));
  };

  // A tap after swiping (or while the delete action is revealed) just closes the
  // row instead of opening the board.
  const handleTap = () => {
    if (movedRef.current || dx !== 0) {
      setDx(0);
      return;
    }
    onOpen();
  };

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
      {/* Delete action behind the row */}
      <button
        onClick={onDelete}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: ROW_ACTION_WIDTH,
          border: "none",
          background: M.danger,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <MobileIcon name="trash" size={16} color="#fff" />
        <span style={{ fontSize: 11, fontWeight: 600 }}>Delete</span>
      </button>

      {/* Foreground row */}
      <div
        onClick={handleTap}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 12,
          cursor: "pointer",
          textAlign: "left",
          boxSizing: "border-box",
          transform: `translateX(${dx}px)`,
          transition: draggingRef.current ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: M.tealLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MobileIcon name="layers" size={15} color={M.tealDark} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: M.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {board.name}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: M.textMuted,
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
      </div>
    </div>
  );
}

// ── Hub tab ────────────────────────────────────────────────────
export default function MobileHub({
  suggestedName,
  onBoardLoaded,
}: {
  suggestedName: string;
  onBoardLoaded: () => void;
}) {
  const boardContext = useBoardContext();
  const [saved, setSaved] = useState<SavedBoard[]>([]);
  const [sheet, setSheet] = useState<null | "runtimes" | "coordinators">(null);

  const refresh = () => setSaved(getLocalBoards());
  useEffect(refresh, []);

  if (!boardContext) {
    return null;
  }

  const rtCount = boardContext.runtimes.length;
  const svcCount = Object.values(boardContext.services).flat().length;
  const displayName = boardContext.boardName || suggestedName || "Untitled Board";

  const loadDescriptor = async (descriptor: BoardDescriptor, label: string) => {
    await boardContext.setBoardState(descriptor);
    toast.success(`Loaded “${label}”`);
    onBoardLoaded();
  };

  const onLoad = async (board: SavedBoard) => {
    const descriptor = getLocalBoard(board.name);
    if (!descriptor) {
      toast.error(`Could not load “${board.name}”`);
      return;
    }
    await loadDescriptor(descriptor, board.name);
  };

  const onDelete = (board: SavedBoard) => {
    removeLocalBoard(board);
    refresh();
    toast.success(`Deleted “${board.name}”`);
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: 16,
      }}
    >
      {/* ── Current board ── */}
      <SectionHeader title="This board" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: M.card,
          borderRadius: 14,
          border: `1px solid ${M.border}`,
          padding: 14,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: M.tealLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MobileIcon name="layers" size={18} color={M.tealDark} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: M.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: M.textMuted, marginTop: 2 }}>
            {rtCount} runtime{rtCount !== 1 ? "s" : ""} · {svcCount} service
            {svcCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── Connections ── */}
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Connections" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ConnectionButton
            icon="server"
            label="Manage Runtimes"
            sublabel="External runtime servers for the board"
            onClick={() => setSheet("runtimes")}
          />
          <ConnectionButton
            icon="cloud"
            label="Manage Coordinators"
            sublabel="Cloud hosts that run shared boards"
            onClick={() => setSheet("coordinators")}
          />
        </div>
      </div>

      {/* ── Saved boards ── */}
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Saved boards" count={saved.length} />
        {saved.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: M.textMuted,
              fontStyle: "italic",
              padding: "8px 4px",
              lineHeight: 1.5,
            }}
          >
            No saved boards yet — use the ⋯ menu to keep this board on your
            device.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saved.map((board) => (
              <SavedBoardRow
                key={board.id}
                board={board}
                onOpen={() => onLoad(board)}
                onDelete={() => onDelete(board)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Demos ── */}
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Demos" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DEMO_BOARDS.map((demo) => (
            <DemoCard
              key={demo.label}
              demo={demo}
              onOpen={() => loadDescriptor(demo.board, demo.label)}
            />
          ))}
        </div>
      </div>

      {/* ── Connection management sheets ── */}
      <ManageRuntimesSheet
        open={sheet === "runtimes"}
        onClose={() => setSheet(null)}
      />
      <ManageCoordinatorsSheet
        open={sheet === "coordinators"}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

// ── Connection row (opens a management sheet) ──────────────────
function ConnectionButton({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: MobileIconName;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        width: "100%",
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: M.blueLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MobileIcon name={icon} size={18} color={M.blue} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 2 }}>
          {sublabel}
        </div>
      </div>
      <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
    </button>
  );
}

// ── Demo board card ────────────────────────────────────────────
function DemoCard({
  demo,
  onOpen,
}: {
  demo: DemoEntry;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        width: "100%",
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: M.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {demo.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: M.textPrimary,
          }}
        >
          {demo.label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: M.textMuted,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {demo.description}
        </div>
      </div>
      <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
    </button>
  );
}
