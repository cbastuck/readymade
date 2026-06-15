import { useEffect, useRef, useState } from "react";
import { ServiceClass } from "../../../types";
import { M } from "./tokens";
import MobileIcon from "./MobileIcon";

export type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  state?: any;
};

type Props = {
  entries: PipelineEntry[];
  /** Runtime registry, used to resolve display names + descriptions. */
  registry: ServiceClass[];
  /** Drill into a sub-service (push a breadcrumb level). */
  onOpen: (entry: PipelineEntry) => void;
  /** Open the service picker bound to this pipeline. */
  onAdd: () => void;
  /** Remove a sub-service from this pipeline. */
  onRemove: (instanceId: string) => void;
  /** Persist a new order. Called once on drop. */
  onReorder: (entries: PipelineEntry[]) => void;
};

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ── Drag handle (three stacked lines) ──────────────────────────
function GripIcon({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="5" y1="15" x2="19" y2="15" />
    </svg>
  );
}

export default function MobileSubPipeline({
  entries,
  registry,
  onOpen,
  onAdd,
  onRemove,
  onReorder,
}: Props) {
  // ── Long-press drag-to-reorder ───────────────────────────────
  // `dragIndex` is the entry being dragged (in the *original* order).
  // `overIndex` is the slot it would drop into. `slots` holds the static Y
  // midpoints captured at drag start so the target stays stable while items
  // reflow underneath the finger.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const slotsRef = useRef<number[]>([]);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startYRef = useRef(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Block page scroll while a drag is in progress.
  useEffect(() => {
    if (dragIndex === null) {
      return;
    }
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [dragIndex]);

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const beginDrag = (index: number) => {
    // Capture the static slot midpoints so reordering is stable.
    slotsRef.current = cardRefs.current.map((el) => {
      if (!el) {
        return Number.POSITIVE_INFINITY;
      }
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    setDragIndex(index);
    setOverIndex(index);
  };

  const computeOver = (clientY: number): number => {
    const slots = slotsRef.current;
    let idx = 0;
    for (let i = 0; i < slots.length; i++) {
      if (clientY > slots[i]) {
        idx = i + 1;
      }
    }
    return Math.max(0, Math.min(entries.length - 1, idx));
  };

  const handlePointerDown = (index: number, clientY: number) => {
    startYRef.current = clientY;
    cancelPress();
    pressTimer.current = setTimeout(() => beginDrag(index), 280);
  };

  const handlePointerMove = (clientY: number) => {
    if (dragIndex === null) {
      // Still waiting on the long-press — treat a real move as scroll intent.
      if (Math.abs(clientY - startYRef.current) > 10) {
        cancelPress();
      }
      return;
    }
    setOverIndex(computeOver(clientY));
  };

  const handlePointerUp = () => {
    cancelPress();
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder(move(entries, dragIndex, overIndex));
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  // Order shown while dragging (live preview); committed order on drop.
  const displayed =
    dragIndex !== null && overIndex !== null
      ? move(entries, dragIndex, overIndex)
      : entries;

  const descriptorFor = (serviceId: string) =>
    registry.find((s) => s.serviceId === serviceId);

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: M.textMuted,
          textTransform: "uppercase",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <MobileIcon name="layers" size={13} color={M.textMuted} />
        Sub-services
        <span style={{ color: M.textMuted, fontWeight: 500 }}>
          ({entries.length})
        </span>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: M.textMuted,
            fontStyle: "italic",
            textAlign: "center",
            padding: "10px 0 14px",
          }}
        >
          Empty pipeline — add a service to run inside this module.
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}
        >
          {displayed.map((entry) => {
            const originalIndex = entries.findIndex(
              (e) => e.instanceId === entry.instanceId,
            );
            const isDragged = dragIndex !== null && originalIndex === dragIndex;
            const descriptor = descriptorFor(entry.serviceId);
            const name =
              descriptor?.serviceName ??
              (entry.state && entry.state.serviceName) ??
              entry.serviceId;

            return (
              <div
                key={entry.instanceId}
                ref={(el) => {
                  cardRefs.current[originalIndex] = el;
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 10px 10px 12px",
                  background: M.card,
                  border: `1.5px solid ${isDragged ? M.teal : M.border}`,
                  borderRadius: 12,
                  boxShadow: isDragged
                    ? `0 6px 18px rgba(0,0,0,0.15)`
                    : "0 1px 2px rgba(0,0,0,0.04)",
                  transform: isDragged ? "scale(1.02)" : "none",
                  transition: dragIndex === null ? "transform 0.15s, box-shadow 0.15s" : "none",
                  touchAction: dragIndex !== null ? "none" : "auto",
                }}
              >
                {/* Drag handle — long-press to reorder */}
                <div
                  onPointerDown={(e) => handlePointerDown(originalIndex, e.clientY)}
                  onPointerMove={(e) => handlePointerMove(e.clientY)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 36,
                    flexShrink: 0,
                    cursor: "grab",
                    touchAction: "none",
                    color: M.textMuted,
                  }}
                  title="Long-press and drag to reorder"
                >
                  <GripIcon color={M.textMuted} />
                </div>

                {/* Body — tap to drill in */}
                <button
                  onClick={() => onOpen(entry)}
                  disabled={dragIndex !== null}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
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
                    <MobileIcon name="cpu" size={15} color={M.tealDark} />
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
                      {name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: M.textMuted,
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.serviceId}
                    </div>
                  </div>
                  <MobileIcon name="chevronRight" size={15} color={M.textMuted} />
                </button>

                {/* Remove */}
                <button
                  onClick={() => onRemove(entry.instanceId)}
                  disabled={dragIndex !== null}
                  title="Remove sub-service"
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    border: "none",
                    background: "none",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <MobileIcon name="trash" size={15} color={M.textMuted} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onAdd}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 14px",
          border: `1.5px dashed ${M.teal}`,
          borderRadius: 12,
          background: M.tealLight,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: M.tealDark,
          fontFamily: "inherit",
        }}
      >
        <MobileIcon name="plus" size={15} color={M.tealDark} />
        Add sub-service
      </button>
    </div>
  );
}
