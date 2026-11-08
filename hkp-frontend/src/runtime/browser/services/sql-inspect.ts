/**
 * Looking into a SQL service's database without running anything of the
 * board's: which tables there are, how many rows each holds, and the rows
 * themselves a page at a time.
 *
 * Read only. Nothing here applies a schema, changes a row or reports to the
 * board — the inspector is for seeing what a pipeline left behind, and a
 * look that changed it would show something the board never did.
 */
import { Database, SqlRow } from "./sql-database";

/** What a service's own statements do with a table. */
export type TableUse = "writes" | "reads" | null;

export type InspectedTable = {
  name: string;
  type: "table" | "view";
  /** How many rows a table holds; a view is counted when it is looked at. */
  rows: number | null;
  /** The statement that created it, as SQLite keeps it. */
  sql: string;
  /** What the service's statement does with it, if it names it at all. */
  use: TableUse;
};

export type InspectedRows = {
  columns: string[];
  rows: unknown[][];
  /** Rows in the whole table, not only this page. */
  total: number;
};

/** A name as an identifier: quoted, so any name SQLite accepts is read back. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * The statement with comments and string literals blanked out, so a table name
 * mentioned in a comment or a value is not taken for one the statement uses.
 * Double-quoted identifiers stay: `"booking"` is the table `booking`.
 */
function codeOnly(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether a statement writes a table, reads it, or does not name it.
 *
 * Written is what follows INSERT INTO, REPLACE INTO, UPDATE or DELETE FROM;
 * any other mention is a read. A heuristic over the text rather than a parse,
 * which is what an inspector pointing at the tables that matter needs.
 */
export function tableUse(name: string, statement: string): TableUse {
  const code = codeOnly(statement);
  const ident = `(?:"${escapeRegExp(name.replace(/"/g, '""'))}"|${escapeRegExp(name)}(?![\\w$]))`;
  const writes = new RegExp(
    `(?:\\binsert\\s+(?:or\\s+\\w+\\s+)?into|\\breplace\\s+into|\\bupdate(?:\\s+or\\s+\\w+)?|\\bdelete\\s+from)\\s+(?:main\\.)?${ident}`,
    "i",
  );
  if (writes.test(code)) {
    return "writes";
  }
  const mentioned = new RegExp(`(?<![\\w$])${ident}`, "i");
  return mentioned.test(code) ? "reads" : null;
}

/** Every table and view in the database, the ones the statement uses first. */
export function listTables(db: Database, statement: string): InspectedTable[] {
  const found = db.query(
    `SELECT name, type, IFNULL(sql, '') AS sql FROM sqlite_schema
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
      ORDER BY name`,
  ) as Array<{ name: string; type: "table" | "view"; sql: string }>;
  const order: Record<string, number> = { writes: 0, reads: 1 };
  return found
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      sql: entry.sql,
      rows: entry.type === "table" ? countRows(db, entry.name) : null,
      use: tableUse(entry.name, statement),
    }))
    .sort(
      (a, b) =>
        (order[a.use ?? ""] ?? 2) - (order[b.use ?? ""] ?? 2) ||
        a.name.localeCompare(b.name),
    );
}

function countRows(db: Database, table: string): number {
  const [row] = db.query(`SELECT count(*) AS n FROM ${quoteIdentifier(table)}`);
  return Number(row?.n ?? 0);
}

/**
 * A page of a table's rows, with its columns — taken from the table rather
 * than the rows, so an empty table still shows what it holds.
 */
export function readRows(
  db: Database,
  table: string,
  offset: number,
  limit: number,
): InspectedRows {
  const exists = db.query(
    "SELECT 1 FROM sqlite_schema WHERE type IN ('table', 'view') AND name = $name",
    { $name: table },
  );
  if (exists.length === 0) {
    throw new Error(`no table '${table}' in this database`);
  }
  const columns = (
    db.query(`PRAGMA table_info(${quoteIdentifier(table)})`) as SqlRow[]
  ).map((column) => String(column.name));
  const rows = db
    .query(`SELECT * FROM ${quoteIdentifier(table)} LIMIT $limit OFFSET $offset`, {
      $limit: Math.max(0, Math.floor(limit)),
      $offset: Math.max(0, Math.floor(offset)),
    })
    .map((row) => columns.map((column) => row[column]));
  return { columns, rows, total: countRows(db, table) };
}
