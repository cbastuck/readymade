import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import Column, { ColumnVM } from "./Column";
import Row, { RowVM } from "./Row";

interface Props {
  columns: ColumnVM[];
  breadcrumb: string;
  searchQuery: string;
  onSearchQuery: (query: string) => void;
  /** Flat result rows shown instead of the columns while searching. */
  searchResults: RowVM[];
  /** Details column for the selected board, rendered after the columns. */
  detail?: ReactNode;
}

export default function ColumnBrowser({
  columns,
  breadcrumb,
  searchQuery,
  onSearchQuery,
  searchResults,
  detail,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searching = searchQuery.trim().length > 0;

  // Keep the deepest column (or the details panel) in view as the user
  // drills down.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [columns.length, detail]);

  return (
    <main
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        padding: "16px 26px 22px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {searching ? "Search" : "Browse"}
          </h2>
          <span
            style={{
              fontSize: 12,
              color: "#8b90a0",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {searching
              ? `${searchResults.length} ${searchResults.length === 1 ? "result" : "results"}`
              : breadcrumb}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "0 0 auto" }}>
          <input
            className="st-search"
            type="search"
            placeholder="Search boards and tags…"
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="st-h"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "stretch",
          overflowX: "auto",
          background: "#fff",
          border: "1px solid var(--st-line)",
          borderRadius: 16,
        }}
      >
        {searching ? (
          <div className="st-v" style={{ flex: "1 1 auto", overflowY: "auto", padding: 6 }}>
            {searchResults.map((it) => (
              <Row key={it.key} it={it} />
            ))}
            {searchResults.length === 0 && (
              <div
                style={{
                  padding: "26px 14px",
                  textAlign: "center",
                  color: "#b0b5c2",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                No boards match “{searchQuery.trim()}”
              </div>
            )}
          </div>
        ) : (
          <>
            {columns.map((col) => (
              <Column key={col.key} col={col} />
            ))}
            {detail}
          </>
        )}
      </div>
    </main>
  );
}
