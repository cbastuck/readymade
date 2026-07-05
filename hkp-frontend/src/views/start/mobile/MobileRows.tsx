import { useRef, useState, type ReactNode, type TouchEvent } from "react";

import { M } from "../../playground/mobile/tokens";
import MobileIcon from "../../playground/mobile/MobileIcon";
import { artFor, attentionCount, isAttentionState, stateMeta } from "../model";
import { BoardNode, FolderNode } from "../types";

const ROW_ACTION_WIDTH = 92;

/**
 * Horizontal swipe-to-reveal wrapper (the mobile counterpart of the desktop
 * rows' hover "–" button): swiping left uncovers a destructive action behind
 * the row; a tap while revealed closes it instead of triggering the row.
 */
export function SwipeRow({
  actionLabel,
  onAction,
  onTap,
  children,
}: {
  actionLabel: string;
  /** Absent = the row does not reveal an action (plain tappable row). */
  onAction?: () => void;
  onTap: () => void;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const startXRef = useRef(0);
  const baseRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  const swipeEnabled = onAction !== undefined;

  const onTouchStart = (e: TouchEvent) => {
    if (!swipeEnabled) {
      return;
    }
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
    setDx(Math.max(-ROW_ACTION_WIDTH, Math.min(0, baseRef.current + delta)));
  };
  const onTouchEnd = () => {
    draggingRef.current = false;
    setDx((prev) => (prev < -ROW_ACTION_WIDTH / 2 ? -ROW_ACTION_WIDTH : 0));
  };

  const handleTap = () => {
    if (movedRef.current || dx !== 0) {
      setDx(0);
      return;
    }
    onTap();
  };

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
      {swipeEnabled && (
        <button
          onClick={onAction}
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
          <span style={{ fontSize: 11, fontWeight: 600 }}>{actionLabel}</span>
        </button>
      )}
      <div
        onClick={handleTap}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          transform: `translateX(${dx}px)`,
          transition: draggingRef.current ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function RowShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 14px",
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        cursor: "pointer",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

function RowText({
  name,
  sub,
  subColor,
}: {
  name: string;
  sub?: string;
  subColor?: string;
}) {
  return (
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
        {name}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: subColor ?? M.textMuted,
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** Board row: artwork tile, name, state subtitle with attention dot. */
export function BoardRow({
  board,
  subOverride,
  onTap,
  onRemove,
}: {
  board: BoardNode;
  /** Replaces the state subtitle (e.g. the folder path on search results). */
  subOverride?: string;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const meta = stateMeta(board.state);
  const attention = isAttentionState(board.state);
  const sub =
    subOverride ??
    board.sub ??
    (board.by ? `${meta.label} · ${board.by}` : meta.label);

  return (
    <SwipeRow actionLabel="Remove" onAction={onRemove} onTap={onTap}>
      <RowShell>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: board.art ?? artFor(board.name),
            flexShrink: 0,
          }}
        />
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginTop: 1,
            }}
          >
            {attention && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: meta.dot,
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: 11,
                color: attention ? meta.dot : M.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sub}
            </span>
          </div>
        </div>
        <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
      </RowShell>
    </SwipeRow>
  );
}

/** Folder row: glyph tile, name, item count, attention badge. */
export function FolderRow({
  folder,
  onTap,
  onRemove,
}: {
  folder: FolderNode;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const count = folder.children.length;
  const badge = attentionCount(folder);
  const art =
    folder.art ??
    (folder.source
      ? "linear-gradient(160deg, #3a3d4a, #14161c)"
      : "linear-gradient(160deg, #eef0f4, #dfe2ea)");
  const glyphColor = folder.source || folder.art ? "#fff" : "#5b6070";

  return (
    <SwipeRow actionLabel="Remove" onAction={onRemove} onTap={onTap}>
      <RowShell>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: art,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: glyphColor,
            flexShrink: 0,
          }}
        >
          {folder.name.charAt(0).toUpperCase()}
        </div>
        <RowText
          name={folder.name}
          sub={count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}
        />
        {badge > 0 && (
          <span
            style={{
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              borderRadius: 10,
              background: M.teal,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
        <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
      </RowShell>
    </SwipeRow>
  );
}
