import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import Column, { ColumnVM } from "./Column";
import Row, { RowVM } from "./Row";
import { BoardSort } from "./types";

interface Props {
  columns: ColumnVM[];
  breadcrumb: string;
  searchQuery: string;
  onSearchQuery: (query: string) => void;
  /** Flat result rows shown instead of the columns while searching. */
  searchResults: RowVM[];
  /** Details column for the selected board, rendered after the columns. */
  detail?: ReactNode;
  /** Current board order; drives the Name / Recent toggle. */
  sort: BoardSort;
  onSort: (sort: BoardSort) => void;
  /** Whether the boards on screen carry a modification time. Sources whose
   *  boards have none (demos, cloud) show the toggle disabled rather than
   *  offering an order it cannot produce. */
  sortable: boolean;
}

const SORT_OPTIONS: Array<{ value: BoardSort; label: string; title: string }> =
  [
    { value: "name", label: "Name", title: "Sort boards by name" },
    { value: "recent", label: "Recent", title: "Sort boards by last modified" },
  ];

const NO_DATE_HINT = "These boards carry no modification date";

function SortToggle({
  sort,
  onSort,
  sortable,
}: {
  sort: BoardSort;
  onSort: (sort: BoardSort) => void;
  sortable: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: 9,
        background: "#e9ebf0",
        flex: "0 0 auto",
        opacity: sortable ? 1 : 0.5,
      }}
    >
      {SORT_OPTIONS.map((option) => {
        const active = sortable && option.value === sort;
        return (
          <button
            key={option.value}
            type="button"
            disabled={!sortable}
            title={sortable ? option.title : NO_DATE_HINT}
            onClick={() => onSort(option.value)}
            style={{
              border: "none",
              borderRadius: 7,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: sortable ? "pointer" : "default",
              color: active ? "#14161c" : "#6b7080",
              background: active ? "#fff" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ColumnBrowser({
  columns,
  breadcrumb,
  searchQuery,
  onSearchQuery,
  searchResults,
  detail,
  sort,
  onSort,
  sortable,
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
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            minWidth: 0,
          }}
        >
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flex: "0 0 auto",
          }}
        >
          {!searching && (
            <SortToggle sort={sort} onSort={onSort} sortable={sortable} />
          )}
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
          <div
            className="st-v"
            style={{ flex: "1 1 auto", overflowY: "auto", padding: 6 }}
          >
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
