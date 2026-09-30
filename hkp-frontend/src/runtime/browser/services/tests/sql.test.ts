import { describe, expect, it, vi } from "vitest";

import SqlDescriptor from "../Sql";
import {
  SqlPersistence,
  checkDatabaseName,
  createDatabaseStore,
  sqliteMessage,
} from "../sql-database";

/**
 * The browser SQL service against the real engine. The page's databases are
 * shared by name, so every test names its own.
 */

let counter = 0;
const uniqueName = () => `test-${Date.now()}-${++counter}`;

function createApp() {
  return {
    notify: vi.fn(),
    log: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
  };
}

function create(state: Record<string, unknown>) {
  const app = createApp();
  const svc: any = SqlDescriptor.create(
    app as any,
    "test-board",
    SqlDescriptor as any,
    `sql-${++counter}`,
  );
  svc.configure(state);
  app.notify.mockClear();
  return { svc, app };
}

const SCHEMA =
  "CREATE TABLE IF NOT EXISTS mail (id TEXT PRIMARY KEY, thread TEXT NOT NULL, body TEXT);";

describe("the browser SQL service", () => {
  it("runs, queries and reports what it did", async () => {
    const database = uniqueName();
    const { svc: insert, app } = create({
      database,
      mode: "run",
      schema: SCHEMA,
      statement: "INSERT INTO mail VALUES ($id, $thread, $body)",
    });
    const inserted = await insert.process({
      id: "a",
      thread: "t",
      body: "it's here",
      unused: "not a parameter",
    });
    expect(inserted).toEqual({ changes: 1, lastInsertRowid: 1 });
    expect(app.notify).toHaveBeenCalledWith(insert, inserted);

    const { svc: read } = create({
      database,
      mode: "query",
      statement: "SELECT id, body FROM mail WHERE thread = :thread",
    });
    expect(await read.process({ thread: "t" })).toEqual({
      rows: [{ id: "a", body: "it's here" }],
      count: 1,
    });
  });

  it("reads parameters only from code, never from literals or comments", async () => {
    const { svc } = create({
      database: uniqueName(),
      statement:
        "SELECT $who AS who, 'anna@example.com' AS address -- and not @this\n /* nor :that */",
    });
    const result = await svc.process({ who: "anna" });
    expect(result.rows).toEqual([
      { who: "anna", address: "anna@example.com" },
    ]);
  });

  it("binds booleans, objects and missing values as SQLite can store them", async () => {
    const { svc } = create({
      database: uniqueName(),
      statement: "SELECT $flag AS flag, $data AS data, $missing AS missing",
    });
    const result = await svc.process({ flag: true, data: { a: 1 } });
    expect(result.rows).toEqual([
      { flag: 1, data: '{"a":1}', missing: null },
    ]);
  });

  it("hands large integers on as JSON can carry them", async () => {
    const { svc } = create({
      database: uniqueName(),
      statement: "SELECT 42 AS small, 9007199254740993 AS large",
    });
    const result = await svc.process({});
    expect(result.rows).toEqual([{ small: 42, large: "9007199254740993" }]);
  });

  it("passes the input through with emit: input, and still reports", async () => {
    const database = uniqueName();
    const { svc, app } = create({
      database,
      mode: "run",
      emit: "input",
      schema: SCHEMA,
      statement: "INSERT INTO mail VALUES ($id, 't', NULL)",
    });
    const input = { id: "x", other: 1 };
    expect(await svc.process(input)).toBe(input);
    expect(app.notify).toHaveBeenCalledWith(svc, {
      changes: 1,
      lastInsertRowid: 1,
    });
  });

  it("shares tables between services naming the same database", async () => {
    const database = uniqueName();
    const { svc: owner } = create({
      database,
      mode: "exec",
      statement: "CREATE TABLE shared_rows (n INTEGER)",
    });
    await owner.process({});
    const { svc: writer } = create({
      database,
      mode: "run",
      statement: "INSERT INTO shared_rows VALUES (7)",
    });
    await writer.process({});
    const { svc: other } = create({
      database: uniqueName(),
      statement: "SELECT count(*) AS n FROM shared_rows",
    });
    expect(await other.process({})).toBeNull();
    const { svc: reader } = create({
      database,
      statement: "SELECT n FROM shared_rows",
    });
    expect((await reader.process({})).rows).toEqual([{ n: 7 }]);
  });

  it("applies the schema once per database", async () => {
    const database = uniqueName();
    const { svc } = create({
      database,
      mode: "run",
      // Not IF NOT EXISTS: a second application would fail.
      schema: "CREATE TABLE once (n INTEGER);",
      statement: "INSERT INTO once VALUES ($n)",
    });
    expect(await svc.process({ n: 1 })).toEqual({
      changes: 1,
      lastInsertRowid: 1,
    });
    expect(await svc.process({ n: 2 })).toEqual({
      changes: 1,
      lastInsertRowid: 2,
    });
  });

  it("reports a refused statement as the engine words it, and passes nothing on", async () => {
    const database = uniqueName();
    const { svc, app } = create({
      database,
      mode: "run",
      schema: SCHEMA,
      statement: "INSERT INTO mail VALUES ($id, 't', NULL)",
    });
    await svc.process({ id: "dup" });
    app.notify.mockClear();
    expect(await svc.process({ id: "dup" })).toBeNull();
    expect(app.notify).toHaveBeenCalledWith(svc, {
      error: "run failed: UNIQUE constraint failed: mail.id",
    });
    expect(app.log).toHaveBeenCalledWith(svc, "error", "service.failed", {
      message: "run failed: UNIQUE constraint failed: mail.id",
    });
  });

  it("refuses to run without a statement", async () => {
    const { svc, app } = create({ database: uniqueName() });
    expect(await svc.process({})).toBeNull();
    expect(app.notify).toHaveBeenCalledWith(svc, {
      error: "sql has no statement to run",
    });
  });

  it("refuses a database name hkp-node would refuse", async () => {
    const { svc, app } = create({ database: "../elsewhere", statement: "SELECT 1" });
    expect(await svc.process({})).toBeNull();
    expect(app.notify.mock.calls[0][1].error).toMatch(
      /could not open the board's database: '..\/elsewhere' is not a database name/,
    );
    expect(checkDatabaseName("shared")).toMatch(/reserved/);
    expect(checkDatabaseName("tennis")).toBeNull();
  });

  it("keeps its configuration, and not what the last pass reported", async () => {
    const { svc } = create({
      database: "tennis",
      mode: "run",
      emit: "input",
      statement: "SELECT 1",
      schema: "",
    });
    expect(await svc.getConfiguration()).toEqual({
      mode: "run",
      emit: "input",
      database: "tennis",
      statement: "SELECT 1",
      schema: "",
      bypass: false,
    });
  });
});

describe("the browser SQL database store", () => {
  function memoryPersistence(): SqlPersistence & { kept: Map<string, Uint8Array> } {
    const kept = new Map<string, Uint8Array>();
    return {
      kept,
      load: async (name) => kept.get(name),
      save: async (name, bytes) => {
        kept.set(name, bytes);
      },
      list: async () =>
        [...kept].map(([name, bytes]) => ({ name, bytes: bytes.byteLength })),
    };
  }

  it("lists what is kept and what is open with something in it", async () => {
    const persistence = memoryPersistence();
    persistence.kept.set("kept-only", new Uint8Array(4096));
    const store = createDatabaseStore({ persistence, saveDelayMs: 60_000 });
    (await store.open("fresh")).exec("CREATE TABLE t (n INTEGER)");
    // Opened to be looked at: holds nothing, and is not a database yet.
    await store.open("looked-at");
    expect((await store.list()).map((db) => db.name)).toEqual([
      "fresh",
      "kept-only",
    ]);
    expect((await store.list())[0].bytes).toBeGreaterThan(0);
    await store.closeAll();
  });

  it("keeps a database between stores through its persistence", async () => {
    const persistence = memoryPersistence();
    const first = createDatabaseStore({ persistence });
    const db = await first.open("kept");
    db.exec("CREATE TABLE t (v TEXT)");
    db.run("INSERT INTO t VALUES ($v)", { $v: "survives" });
    await first.closeAll();
    expect(persistence.kept.has("kept")).toBe(true);

    const second = createDatabaseStore({ persistence });
    const reopened = await second.open("kept");
    expect(reopened.query("SELECT v FROM t")).toEqual([{ v: "survives" }]);
    // The reopened database grows like any other.
    reopened.run("INSERT INTO t VALUES ('more')");
    expect(reopened.query("SELECT count(*) AS n FROM t")).toEqual([{ n: 2 }]);
    await second.closeAll();
  });

  it("writes only what changed", async () => {
    const persistence = memoryPersistence();
    const save = vi.spyOn(persistence, "save");
    const store = createDatabaseStore({ persistence });
    const db = await store.open("quiet");
    db.query("SELECT 1");
    await store.flush();
    expect(save).not.toHaveBeenCalled();

    db.run("CREATE TABLE t (n INTEGER)");
    await store.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await store.closeAll();
  });

  it("writes shortly after a change without being asked", async () => {
    const persistence = memoryPersistence();
    const store = createDatabaseStore({ persistence, saveDelayMs: 5 });
    const db = await store.open("soon");
    db.exec("CREATE TABLE t (n INTEGER)");
    await vi.waitFor(() => expect(persistence.kept.has("soon")).toBe(true));
    await store.closeAll();
  });

  it("strips the engine's result-code preamble from messages", () => {
    expect(
      sqliteMessage(
        new Error(
          "SQLITE_CONSTRAINT_TRIGGER: sqlite3 result code 1811: only the organiser",
        ),
      ),
    ).toBe("only the organiser");
  });
});
