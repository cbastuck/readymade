import { useState, useEffect, useRef, useMemo } from "react";
import { DataTableWidget } from "../../types";
import { findService, resolvePath } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MAX_PAGES = 50;

function extractRow(
  notification: unknown,
  path?: string,
): Record<string, unknown> | null {
  const val = path ? resolvePath(notification, path) : notification;
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
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

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>(widget.columns ?? []);
  const [page, setPage] = useState(0);
  const wasOnLastPage = useRef(true);

  const sourceService = useMemo(
    () => findService(boardContext, widget.source.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.source.serviceUuid],
  );

  useEffect(() => {
    if (!sourceService?.app) return;
    const handler = (notification: any) => {
      if (notification?.__internal) return;
      const row = extractRow(notification, widget.source.path);
      if (!row) return;

      setRows((prev) => addRow(prev, row, maxRows, overflow));

      if (!widget.columns) {
        setColumns((prev) => {
          const newKeys = Object.keys(row).filter((k) => !prev.includes(k));
          return newKeys.length > 0 ? [...prev, ...newKeys] : prev;
        });
      }
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, widget.source.path, maxRows, overflow, widget.columns]);

  // Auto-advance to tail page when following
  useEffect(() => {
    if (wasOnLastPage.current) {
      const total = Math.max(1, Math.ceil(rows.length / pageSize));
      setPage(total - 1);
    }
  }, [rows, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

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
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={1}
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
              displayRows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    height: 28,
                    background:
                      i % 2 === 1 ? "hsl(var(--muted))" : "transparent",
                  }}
                >
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
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))
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
