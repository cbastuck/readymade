import { useEffect, useState } from "react";

import BottomSheet from "./BottomSheet";
import { M } from "./tokens";

/**
 * Naming a block before it is made, as the desktop's dialog does
 * (`useWrapActions` in `WrapSelection`): the services become one sub-service,
 * and that sub-service the first use of a block of this board.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  /** How many services go into it. */
  count: number;
  initialName: string;
  onMake: (name: string) => void;
};

export default function MakeBlockSheet({
  open,
  onClose,
  count,
  initialName,
  onMake,
}: Props) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const make = () => {
    if (name.trim()) {
      onMake(name.trim());
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Make a block" height="auto">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: M.textSecondary, lineHeight: 1.4 }}>
          The {count === 1 ? "service becomes" : `${count} services become`} one
          sub-service, and that sub-service the first use of a block of this
          board. Add it again from Building Blocks.
        </div>
        <input
          autoFocus
          aria-label="Block name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              make();
            }
          }}
          spellCheck={false}
          style={{
            height: 44,
            padding: "0 12px",
            border: `1.5px solid ${M.teal}`,
            borderRadius: 10,
            background: M.card,
            // Anything smaller zooms iOS in on focus, and it stays zoomed.
            fontSize: 16,
            color: M.textPrimary,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          disabled={!name.trim()}
          onClick={make}
          style={{
            height: 46,
            border: "none",
            borderRadius: 12,
            background: M.teal,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            opacity: name.trim() ? 1 : 0.45,
          }}
        >
          Make block
        </button>
      </div>
    </BottomSheet>
  );
}
