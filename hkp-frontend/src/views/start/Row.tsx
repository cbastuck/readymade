import type { MouseEvent } from "react";

/** Pure view model for a single row in a column or in search results. */
export interface RowVM {
  key: string;
  name: string;
  /** CSS background of the artwork tile. */
  art: string;
  /** Letter shown on folder tiles; empty for boards. */
  glyph: string;
  isBoard: boolean;
  /** Attention dot on the artwork tile. */
  dot: boolean;
  dotColor: string;
  sub: string;
  subColor: string;
  /** Attention count bubbling up on folders; empty string hides the badge. */
  badge: string;
  selected: boolean;
  onClick: () => void;
  /** Opens the board; absent hides the Open button. */
  onOpen?: (e: MouseEvent) => void;
  /** Removes the entry from its folder; absent hides the remove button. */
  onRemove?: (e: MouseEvent) => void;
}

export default function Row({ it }: { it: RowVM }) {
  return (
    <div
      className={"st-row" + (it.selected ? " st-row--sel" : "")}
      onClick={it.onClick}
    >
      <div
        style={{
          width: 38,
          height: 38,
          flex: "0 0 38px",
          borderRadius: 9,
          background: it.art,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          position: "relative",
        }}
      >
        {it.glyph}
        {it.dot && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 11,
              height: 11,
              borderRadius: "50%",
              border: "2px solid #fff",
              background: it.dotColor,
            }}
          />
        )}
      </div>

      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {it.name}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: it.subColor,
            fontWeight: 500,
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {it.sub}
        </div>
      </div>

      {it.onRemove && (
        <button
          className="st-remove"
          title="Remove from folder"
          onClick={it.onRemove}
        >
          ✕
        </button>
      )}

      {it.isBoard ? (
        it.onOpen && (
          <button className="st-open" onClick={it.onOpen}>
            Open
          </button>
        )
      ) : (
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {it.badge && (
            <span
              style={{
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "var(--st-accent)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {it.badge}
            </span>
          )}
          <span style={{ color: "#b9bdc9", fontSize: 16, fontWeight: 600 }}>
            &#8250;
          </span>
        </div>
      )}
    </div>
  );
}
