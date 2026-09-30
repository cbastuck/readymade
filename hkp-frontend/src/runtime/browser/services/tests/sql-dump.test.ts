import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import SqlDescriptor from "../Sql";
import { dumpDatabase, refuseImport } from "../sql-dump";

/**
 * The browser's `sql` exporting and importing — and the promise the format
 * exists for: a database built here loads into hkp-node's SQLite
 * (`node:sqlite`), and one from there loads here.
 */

// hkp-node's engine. Required rather than imported: the bundler that serves
// these tests knows `node:fs` as a Node built-in, but not the newer
// prefix-only `node:sqlite`.
const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

let counter = 0;
const uniqueName = () => `dump-${Date.now()}-${++counter}`;

function create(state: Record<string, unknown>) {
  const app = { notify: vi.fn(), log: vi.fn(), next: vi.fn() };
  const svc: any = SqlDescriptor.create(
    app as any,
    "test-board",
    SqlDescriptor as any,
    `sql-dump-${++counter}`,
  );
  svc.configure(state);
  app.notify.mockClear();
  return { svc, app };
}

const SOURCE = `
  CREATE TABLE booking (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    member TEXT NOT NULL,
    note   TEXT,
    score  REAL,
    photo  BLOB
  );
  CREATE UNIQUE INDEX one_per_member ON booking(member);
  CREATE VIEW members AS SELECT member FROM booking;
  INSERT INTO booking (member, note, score, photo) VALUES
    ('anna', 'it''s mine; -- not a comment', 0.1, X'00FF'),
    ('ben', 'two
lines', 1e300, NULL);
`;

const READ_BACK =
  "SELECT id, member, note, score, hex(photo) AS photo FROM booking ORDER BY id";

const EXPECTED = [
  { id: 1, member: "anna", note: "it's mine; -- not a comment", score: 0.1, photo: "00FF" },
  { id: 2, member: "ben", note: "two\nlines", score: 1e300, photo: "" },
];

async function browserDatabaseWith(sql: string) {
  const database = uniqueName();
  await create({ mode: "exec", database, statement: sql }).svc.process({});
  return database;
}

describe("the browser SQL service's export and import", () => {
  it("round-trips a database through SQL text", async () => {
    const database = await browserDatabaseWith(SOURCE);
    const { svc: exporter, app } = create({ mode: "export", database });
    const dump = await exporter.process({});
    expect(typeof dump).toBe("string");
    expect(app.notify).toHaveBeenCalledWith(exporter, {
      exported: database,
      bytes: dump.length,
    });

    const copy = uniqueName();
    const { svc: importer } = create({ mode: "import", database: copy });
    expect(await importer.process(dump)).toEqual({ executed: true });
    const { svc: reader } = create({ database: copy, statement: READ_BACK });
    expect((await reader.process({})).rows).toEqual(EXPECTED);
  });

  it("lists the databases there are", async () => {
    const database = await browserDatabaseWith("CREATE TABLE t (n INTEGER);");
    const { svc } = create({ mode: "databases" });
    const result = await svc.process({});
    expect(result.rows.map((row: any) => row.name)).toContain(database);
    expect(result.count).toBe(result.rows.length);
  });

  it("refuses an import that reaches past its own database", async () => {
    const { svc, app } = create({ mode: "import", database: uniqueName() });
    expect(await svc.process("ATTACH ':memory:' AS other;")).toBeNull();
    expect(app.notify).toHaveBeenCalledWith(svc, {
      error: "import failed: an import may not use ATTACH",
    });
  });
});

describe("the dump between runtimes", () => {
  it("loads a browser export into hkp-node's SQLite", async () => {
    const database = await browserDatabaseWith(SOURCE);
    const dump = await create({ mode: "export", database }).svc.process({});
    expect(refuseImport(dump)).toBeNull();

    const node = new DatabaseSync(":memory:");
    node.exec(dump);
    expect(node.prepare(READ_BACK).all().map((row) => ({ ...row }))).toEqual(
      EXPECTED,
    );
    expect(node.prepare("SELECT * FROM members ORDER BY member").all()).toHaveLength(2);
    node.close();
  });

  it("loads an hkp-node export into the browser", async () => {
    const node = new DatabaseSync(":memory:");
    node.exec(SOURCE);
    const dump = dumpDatabase({
      query: (sql) => node.prepare(sql).all() as Record<string, unknown>[],
    });
    node.close();

    const copy = uniqueName();
    await create({ mode: "import", database: copy }).svc.process(dump);
    const { svc: reader } = create({ database: copy, statement: READ_BACK });
    expect((await reader.process({})).rows).toEqual(EXPECTED);
  });

  it("is written by the same code in both runtimes", () => {
    // hkp-node is a submodule; without it checked out there is nothing to
    // compare against.
    const nodeCopy = "../hkp-node/src/services/sql-dump.ts";
    if (!existsSync(nodeCopy)) {
      return;
    }
    expect(readFileSync(nodeCopy, "utf-8")).toBe(
      readFileSync("src/runtime/browser/services/sql-dump.ts", "utf-8"),
    );
  });
});
