import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { SettingsButton } from "hkp-frontend/src/ui-components/settings/kit";
import { InspectedRows, InspectedTable, TableUse } from "./sql-inspect";
import "./sql-inspector.css";

/**
 * What a SQL service's database holds, opened from the service's panel.
 *
 * The tables down the side, the ones this service's statement writes or reads
 * first; the rows of the one picked beside them, a page at a time. Read only:
 * it is for seeing what a pipeline left behind, and the SQL Explorer board is
 * where rows are changed. It looks again whenever the service reports a pass,
 * so a table being written fills in while it is watched.
 */

const PAGE = 100;

/** Sized like the service configuration dialog, which it sits beside. */
const frameStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(1280px, 92vw)",
  maxWidth: "none",
  height: "min(900px, 86vh)",
  padding: 0,
  gap: 0,
  overflow: "hidden",
  borderRadius: 16,
};

/** What the panel's service offers the inspector. */
export type InspectableSql = {
  inspectTables(): Promise<{ database: string; tables: InspectedTable[] }>;
  inspectRows(table: string, offset: number, limit: number): Promise<InspectedRows>;
};

type Props = {
  service: InspectableSql;
  isOpen: boolean;
  /** Changes whenever the service reports a pass; the inspector looks again. */
  revision: number;
  onClose: () => void;
};

const USE_LABELS: Record<NonNullable<TableUse>, string> = {
  writes: "written here",
  reads: "read here",
};

/** A cell as text, and whether it is a value at all or a stand-in for one. */
export function cellText(value: unknown): { text: string; placeholder: boolean } {
  if (value === null || value === undefined) {
    return { text: "NULL", placeholder: true };
  }
  if (value instanceof Uint8Array) {
    return { text: `[${value.length} bytes]`, placeholder: true };
  }
  if (typeof value === "object") {
    return { text: JSON.stringify(value), placeholder: false };
  }
  return { text: String(value), placeholder: false };
}

function rowCount(n: number): string {
  return `${n} row${n === 1 ? "" : "s"}`;
}

function sentence(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SqlInspector({ service, isOpen, revision, onClose }: Props) {
  const [database, setDatabase] = useState("");
  const [tables, setTables] = useState<InspectedTable[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<InspectedRows | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [error, setError] = useState("");
  const [looks, setLooks] = useState(0);
  const lookAgain = useCallback(() => setLooks((n) => n + 1), []);

  // The tables: on opening, on every pass the service reports, on Refresh.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let current = true;
    service
      .inspectTables()
      .then((found) => {
        if (!current) {
          return;
        }
        setDatabase(found.database);
        setTables(found.tables);
        setError("");
        // Keeps the table being looked at while it is still there; otherwise
        // the first, which is the one this service uses if it uses any.
        setPicked((was) =>
          was && found.tables.some((t) => t.name === was)
            ? was
            : (found.tables[0]?.name ?? null),
        );
      })
      .catch((err) => current && setError(sentence(err)));
    return () => {
      current = false;
    };
  }, [service, isOpen, revision, looks]);

  // The rows of the table picked, at the page shown.
  useEffect(() => {
    if (!isOpen || !picked) {
      setRows(null);
      return;
    }
    let current = true;
    service
      .inspectRows(picked, offset, PAGE)
      .then((page) => {
        if (current) {
          setRows(page);
          setError("");
        }
      })
      .catch((err) => current && setError(sentence(err)));
    return () => {
      current = false;
    };
  }, [service, isOpen, picked, offset, revision, looks]);

  if (!isOpen) {
    return null;
  }

  const pick = (name: string) => {
    setPicked(name);
    setOffset(0);
  };
  const table = tables?.find((t) => t.name === picked) ?? null;
  const total = rows?.total ?? 0;
  const last = Math.min(offset + PAGE, total);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="hkp-set hkp-set-dialog hkp-sql-inspector"
        style={frameStyle}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="hkp-set-frame">
          <div className="hkp-set-nav">
            <DialogPrimitive.Title className="hkp-set-nav-title">
              {database || "Database"}
            </DialogPrimitive.Title>
            <DialogDescription className="sr-only">
              The tables in the database this SQL service uses, and their rows.
            </DialogDescription>
            <div className="hkp-set-nav-list" role="group" aria-label="Tables">
              {(tables ?? []).map((t) => (
                <button
                  key={t.name}
                  className="hkp-set-nav-item hkp-sqli-table"
                  data-state={t.name === picked ? "active" : undefined}
                  aria-current={t.name === picked ? "true" : undefined}
                  onClick={() => pick(t.name)}
                >
                  <span className="hkp-sqli-table-name">{t.name}</span>
                  <span className="hkp-sqli-table-meta">
                    {t.type === "view" ? "view" : rowCount(t.rows ?? 0)}
                    {t.use ? (
                      <span className={`hkp-sqli-use hkp-sqli-use--${t.use}`}>
                        {USE_LABELS[t.use]}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            {tables && tables.length === 0 ? (
              <p className="hkp-set-hint hkp-sqli-empty">
                No tables yet. A service's schema creates them the first time
                the board runs it.
              </p>
            ) : null}
          </div>

          <div className="hkp-set-pane">
            <div className="hkp-set-pane-header hkp-sqli-header">
              <div className="hkp-sqli-heading">
                <h3 className="hkp-set-pane-title">{table?.name ?? "No table"}</h3>
                {table ? (
                  <span className="hkp-set-hint">
                    {table.type === "view" ? "view · " : ""}
                    {rowCount(total)}
                    {table.use ? ` · ${USE_LABELS[table.use]}` : ""}
                  </span>
                ) : null}
              </div>
              <div className="hkp-sqli-actions">
                {table ? (
                  <SettingsButton onClick={() => setShowSql((v) => !v)}>
                    {showSql ? "Hide definition" : "Definition"}
                  </SettingsButton>
                ) : null}
                <SettingsButton onClick={lookAgain}>Refresh</SettingsButton>
              </div>
            </div>

            {error ? <div className="hkp-sqli-error">{error}</div> : null}

            {table && showSql ? (
              <pre className="hkp-sqli-definition">{table.sql}</pre>
            ) : null}

            <div className="hkp-sqli-grid">
              {rows && rows.columns.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      {rows.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.rows.map((row, r) => (
                      <tr key={offset + r}>
                        {row.map((value, c) => {
                          const cell = cellText(value);
                          return (
                            <td
                              key={c}
                              title={cell.text}
                              className={cell.placeholder ? "hkp-sqli-null" : undefined}
                            >
                              {cell.text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {rows && rows.rows.length === 0 && table ? (
                <p className="hkp-set-hint hkp-sqli-empty">This table is empty.</p>
              ) : null}
            </div>

            {total > PAGE ? (
              <div className="hkp-sqli-pager">
                <span className="hkp-set-hint">
                  {offset + 1}–{last} of {total}
                </span>
                <SettingsButton
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE))}
                >
                  Previous
                </SettingsButton>
                <SettingsButton
                  disabled={last >= total}
                  onClick={() => setOffset(offset + PAGE)}
                >
                  Next
                </SettingsButton>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
