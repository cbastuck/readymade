import { useState, useEffect, useRef, useMemo } from "react";
import { DataTableWidget } from "../../types";
import { findService, resolvePath } from "../../findService";
import { useFacadeState } from "../../FacadeStateContext";
import { WidgetRendererProps } from "../widgetRegistry";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_ROW_KEY = "key";
const DEFAULT_SELECTION_STATE = "selection";

type Row = Record<string, unknown>;

/**
 * What a notification says about the table.
 *
 * An object is one more row; an array is the table as it now stands. A service
 * reporting something that happened sends the first, and one reporting what is
 * currently there sends the second — and the difference matters, because
 * appending a queue every time it is read would show every item once per read.
 */
function extractRows(
  notification: unknown,
  path?: string,
): { rows: Row[]; replace: boolean } | null {
  const val = path ? resolvePath(notification, path) : notification;
  if (Array.isArray(val)) {
    return {
      rows: val.filter(
        (item): item is Row => item !== null && typeof item === "object",
      ),
      replace: true,
    };
  }
  if (val !== null && typeof val === "object") {
    return { rows: [val as Row], replace: false };
  }
  return null;
}

/**
 * The value a column names, which may sit inside the row.
 *
 * Dotted, like `source.path`, so a table can show fields of a nested object
 * without a service in front of it reshaping every row — which in the shared
 * Map dialect would need an arrow function, and that dialect has none.
 */
function cellValue(row: Row, column: string): unknown {
  return column.includes(".") ? resolvePath(row, column) : row[column];
}

/** What a dotted column is called: its last segment, not the whole path. */
function columnLabel(column: string): string {
  const dot = column.lastIndexOf(".");
  return dot === -1 ? column : column.slice(dot + 1);
}

function formatCell(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function addRow(
  prev: Record<string, unknown>[],
  row: Record<string, unknown>,
  maxRows: number,
  overflow: "drop-new" | "drop-oldest",
): Record<string, unknown>[] {
  if (prev.length >= maxRows) {
    if (overflow === "drop-new") return prev;
    return [...prev.slice(1), row];
  }
  return [...prev, row];
}

export function DataTableRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<DataTableWidget>) {
  const pageSize = widget.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = widget.maxPages ?? DEFAULT_MAX_PAGES;
  const maxRows = pageSize * maxPages;
  const overflow = widget.overflow ?? "drop-oldest";

  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>(widget.columns ?? []);
  const [page, setPage] = useState(0);
  const wasOnLastPage = useRef(true);
  // Whether this table shows current state rather than a growing log; set by
  // the first notification that carries a whole table.
  const replaces = useRef(false);

  const rowKey = widget.rowKey ?? DEFAULT_ROW_KEY;
  const selectionState = widget.selectionState ?? DEFAULT_SELECTION_STATE;
  const { setState } = useFacadeState();
  const [selected, setSelected] = useState<string[]>([]);

  const sourceService = useMemo(
    () => findService(boardContext, widget.source.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.source.serviceUuid],
  );

  useEffect(() => {
    if (!sourceService?.app) return;
    const handler = (notification: any) => {
      if (notification?.__internal) return;
      const update = extractRows(notification, widget.source.path);
      if (!update) return;

      if (update.replace) {
        replaces.current = true;
      }
      setRows((prev) =>
        update.replace
          ? update.rows
          : update.rows.reduce(
              (acc, row) => addRow(acc, row, maxRows, overflow),
              prev,
            ),
      );

      if (update.replace && widget.selectable) {
        // A row that is no longer there cannot stay picked — it was acted on,
        // by this person or by somebody else looking at the same queue.
        const present = new Set(
          update.rows.map((row) => String(cellValue(row, rowKey) ?? "")),
        );
        setSelected((prev) => prev.filter((key) => present.has(key)));
      }

      if (!widget.columns) {
        setColumns((prev) => {
          const seen = update.rows.flatMap((row) => Object.keys(row));
          const newKeys = seen.filter(
            (k, i) => !prev.includes(k) && seen.indexOf(k) === i,
          );
          return newKeys.length > 0 ? [...prev, ...newKeys] : prev;
        });
      }
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [
    sourceService,
    widget.source.path,
    maxRows,
    overflow,
    widget.columns,
    widget.selectable,
    rowKey,
  ]);

  // Published rather than held: a button elsewhere in the panel is what acts on
  // a selection, and facade state is how one widget reaches another.
  useEffect(() => {
    if (widget.selectable) {
      setState(selectionState, selected);
    }
  }, [selected, selectionState, widget.selectable]);

  const toggleRow = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // Auto-advance to tail page when following.
  //
  // Only for a log, where the newest row is the interesting one. A table that
  // reports what is currently there has no tail to follow — jumping to the last
  // page on every refresh would take somebody working through a queue away from
  // the page they were reading.
  useEffect(() => {
    if (wasOnLastPage.current && !replaces.current) {
      const total = Math.max(1, Math.ceil(rows.length / pageSize));
      setPage(total - 1);
    }
  }, [rows, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Select-all covers the page in view, not the whole buffer: a header box that
  // silently picked rows on other pages would approve things nobody looked at.
  const pageKeys = pageRows
    .map((row) => String(cellValue(row, rowKey) ?? ""))
    .filter(Boolean);
  const allOnPageSelected =
    pageKeys.length > 0 && pageKeys.every((key) => selected.includes(key));

  // Pad to pageSize so the table height never jumps as rows arrive
  const displayRows: Record<string, unknown>[] =
    columns.length > 0
      ? [
          ...pageRows,
          ...Array.from(
            { length: Math.max(0, pageSize - pageRows.length) },
            () => ({}),
          ),
        ]
      : [];

  const handlePageChange = (newPage: number) => {
    wasOnLastPage.current = newPage === totalPages - 1;
    setPage(newPage);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr>
              {widget.selectable && (
                <th
                  style={{
                    position: "sticky",
                    top: 0,
                    padding: "6px 0 6px 12px",
                    width: 28,
                    background: "hsl(var(--background))",
                    borderBottom: "1px solid hsl(var(--border))",
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={pageKeys.length > 0 && allOnPageSelected}
                    onChange={() =>
                      setSelected((prev) =>
                        allOnPageSelected
                          ? prev.filter((key) => !pageKeys.includes(key))
                          : [...new Set([...prev, ...pageKeys])],
                      )
                    }
                    style={{ cursor: "pointer" }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    position: "sticky",
                    top: 0,
                    padding: "6px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    background: "hsl(var(--background))",
                    borderBottom: "1px solid hsl(var(--border))",
                    whiteSpace: "nowrap",
                    color: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {columnLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (widget.selectable ? 1 : 0) || 1}
                  style={{
                    padding: "24px 12px",
                    textAlign: "center",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  No data yet.
                </td>
              </tr>
            ) : (
              displayRows.map((row, i) => {
                const key = String(cellValue(row, rowKey) ?? "");
                const isSelected = !!key && selected.includes(key);
                return (
                <tr
                  key={i}
                  style={{
                    height: 28,
                    background: isSelected
                      ? "hsl(var(--accent, var(--muted)))"
                      : i % 2 === 1
                        ? "hsl(var(--muted))"
                        : "transparent",
                  }}
                >
                  {widget.selectable && (
                    <td
                      style={{
                        padding: "5px 0 5px 12px",
                        width: 28,
                        borderBottom: "1px solid hsl(var(--border))",
                      }}
                    >
                      {/* Padding rows keep the table height steady and stand
                          for nothing, so they get no box to tick. */}
                      {key && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          style={{ cursor: "pointer" }}
                        />
                      )}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col}
                      style={{
                        padding: "5px 12px",
                        borderBottom: "1px solid hsl(var(--border))",
                        whiteSpace: "nowrap",
                        color: "hsl(var(--foreground))",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {formatCell(cellValue(row, col))}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderTop: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
          flexShrink: 0,
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        <span>Page</span>
        <select
          value={safePage}
          onChange={(e) => handlePageChange(Number(e.target.value))}
          style={{
            padding: "3px 6px",
            borderRadius: 4,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--muted))",
            color: "hsl(var(--foreground))",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {Array.from({ length: totalPages }, (_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </select>
        <span>of {totalPages}</span>
        <span style={{ marginLeft: "auto" }}>{rows.length} rows</span>
        <button
          disabled={rows.length === 0}
          onClick={async () => {
            const json = JSON.stringify(rows, null, 2);
            const saucer = (window as any).saucer;
            if ((window as any).__MEANDER_CONFIG__ && saucer?.exposed?.saveJSON) {
              await saucer.exposed.saveJSON(json);
            } else {
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "data.json";
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
          style={{
            padding: "3px 10px",
            borderRadius: 4,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--muted))",
            color: "hsl(var(--foreground))",
            fontSize: 12,
            cursor: rows.length === 0 ? "default" : "pointer",
            opacity: rows.length === 0 ? 0.4 : 1,
          }}
        >
          Download JSON
        </button>
      </div>
    </div>
  );
}
