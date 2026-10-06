import { describe, expect, it, vi } from "vitest";

import SqlDescriptor from "../Sql";
import * as sqlDatabase from "../sql-database";
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

  it("does not run the schema in place of a missing exec statement", async () => {
    // Refused before anything runs. Standing in for the statement, the schema
    // would run a second time on the first pass and again on every one after.
    const database = uniqueName();
    const { svc, app } = create({
      database,
      mode: "exec",
      schema:
        "CREATE TABLE IF NOT EXISTS seeded (n INTEGER); INSERT INTO seeded VALUES (1);",
    });
    expect(await svc.process({})).toBeNull();
    expect(app.notify).toHaveBeenCalledWith(svc, {
      error: "sql has no statement to run",
    });

    const { svc: reader } = create({
      database,
      mode: "query",
      statement: "SELECT count(*) AS n FROM sqlite_master WHERE name = 'seeded'",
    });
    expect(await reader.process({})).toMatchObject({ rows: [{ n: 0 }] });
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

  it("reports a change that could not be kept, where it was made", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createDatabaseStore({
      persistence: {
        load: async () => undefined,
        save: async () => {
          throw new Error("quota exceeded");
        },
        list: async () => [],
      },
    });
    const databases = vi
      .spyOn(sqlDatabase, "sqlDatabases")
      .mockReturnValue(store);
    const database = uniqueName();
    const writer = create({
      mode: "run",
      database,
      schema: "CREATE TABLE IF NOT EXISTS t (n INTEGER)",
      statement: "INSERT INTO t VALUES ($n)",
    });
    const reader = create({
      mode: "query",
      database,
      statement: "SELECT n FROM t",
    });

    // The statement itself succeeded, and says so.
    expect(await writer.svc.process({ n: 1 })).toMatchObject({ changes: 1 });
    expect(await reader.svc.process({})).toMatchObject({ count: 1 });
    await store.flush();

    expect(writer.app.notify).toHaveBeenLastCalledWith(writer.svc, {
      error: `database '${database}' could not be kept in this browser: quota exceeded`,
    });
    expect(reader.app.notify).not.toHaveBeenCalledWith(
      reader.svc,
      expect.objectContaining({ error: expect.anything() }),
    );
    databases.mockRestore();
    warn.mockRestore();
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

  it("keeps nothing of a transaction until it ends", async () => {
    const persistence = memoryPersistence();
    const store = createDatabaseStore({ persistence });
    const db = await store.open("committed");
    db.exec("CREATE TABLE t (v TEXT)");
    await store.flush();

    const save = vi.spyOn(persistence, "save");
    db.exec("BEGIN");
    db.run("INSERT INTO t VALUES ('held')");
    // As a page hidden half way through would ask.
    await store.flush();
    expect(save).not.toHaveBeenCalled();

    db.exec("COMMIT");
    await store.closeAll();
    expect(save).toHaveBeenCalledTimes(1);
    const reopened = await createDatabaseStore({ persistence }).open(
      "committed",
    );
    expect(reopened.query("SELECT v FROM t")).toEqual([{ v: "held" }]);
  });

  it("keeps nothing of a transaction that was rolled back", async () => {
    const persistence = memoryPersistence();
    const store = createDatabaseStore({ persistence, saveDelayMs: 1 });
    const db = await store.open("undone");
    db.exec("CREATE TABLE t (v TEXT)");
    db.exec("BEGIN");
    db.run("INSERT INTO t VALUES ('taken back')");
    // Long enough for the write the insert asked for to have come up.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(persistence.kept.has("undone")).toBe(false);

    db.exec("ROLLBACK");
    // The table, made before the transaction began, is kept once it is over.
    await vi.waitFor(() => expect(persistence.kept.has("undone")).toBe(true));
    await store.closeAll();
    const reopened = await createDatabaseStore({ persistence }).open("undone");
    expect(reopened.query("SELECT count(*) AS n FROM t")).toEqual([{ n: 0 }]);
  });

  it("has one write of a database on its way at a time", async () => {
    const persistence = memoryPersistence();
    const finish: Array<() => void> = [];
    const save = vi.spyOn(persistence, "save").mockImplementation(
      (name, bytes) =>
        new Promise<void>((resolve) => {
          finish.push(() => {
            persistence.kept.set(name, bytes);
            resolve();
          });
        }),
    );
    const store = createDatabaseStore({ persistence, saveDelayMs: 1 });
    const db = await store.open("busy");
    db.exec("CREATE TABLE t (n INTEGER)");
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    // Changed again, twice over, while that write is still on its way.
    db.run("INSERT INTO t VALUES (1)");
    await new Promise((resolve) => setTimeout(resolve, 20));
    db.run("INSERT INTO t VALUES (2)");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(save).toHaveBeenCalledTimes(1);

    // Both changes go in the one write that follows it.
    finish.shift()!();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    finish.shift()!();
    await store.closeAll();
    expect(save).toHaveBeenCalledTimes(2);
    const reopened = await createDatabaseStore({ persistence }).open("busy");
    expect(reopened.query("SELECT count(*) AS n FROM t")).toEqual([{ n: 2 }]);
  });

  it("does not wait for a write on its way when asked to flush", async () => {
    const persistence = memoryPersistence();
    const finish: Array<() => void> = [];
    const save = vi
      .spyOn(persistence, "save")
      .mockImplementation(
        () => new Promise<void>((resolve) => void finish.push(resolve)),
      );
    const store = createDatabaseStore({ persistence, saveDelayMs: 1 });
    const db = await store.open("leaving");
    db.exec("CREATE TABLE t (n INTEGER)");
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    db.run("INSERT INTO t VALUES (1)");
    // A page going away gets no later task to start the write in.
    const flushed = store.flush();
    expect(save).toHaveBeenCalledTimes(2);
    finish.forEach((done) => done());
    await flushed;
    await store.closeAll();
  });

  it("tells whoever changed a database that it could not be kept", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const persistence = memoryPersistence();
    vi.spyOn(persistence, "save").mockRejectedValueOnce(
      new Error("quota exceeded"),
    );
    const store = createDatabaseStore({ persistence });
    const writer = vi.fn();
    const reader = vi.fn();
    const written = await store.open("full", writer);
    const read = await store.open("full", reader);
    written.exec("CREATE TABLE t (n INTEGER)");
    read.query("SELECT * FROM t");

    await store.flush();
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0][0]).toEqual(new Error("quota exceeded"));
    expect(writer.mock.calls[0][1]).toBe("full");
    expect(reader).not.toHaveBeenCalled();
    expect(persistence.kept.has("full")).toBe(false);

    // Still to be kept: the next write carries it, and nobody is told twice.
    await store.flush();
    expect(persistence.kept.has("full")).toBe(true);
    expect(writer).toHaveBeenCalledTimes(1);
    await store.closeAll();
    warn.mockRestore();
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

describe("the caller parameters", () => {
  const WHOAMI =
    "SELECT $caller_email AS email, :caller_name AS name, @caller_sub AS sub, $other AS other";

  function createAs(user: unknown) {
    const { svc, app } = create({
      database: uniqueName(),
      mode: "query",
      statement: WHOAMI,
    });
    (app as any).getAuthenticatedUser = () => user;
    return svc;
  }

  it("are whoever is signed in to the app, over an input field of the same name", async () => {
    const svc = createAs({
      userId: "auth0|ada",
      username: "Ada",
      email: " Ada@Example.com ",
      idToken: "t",
    });

    const { rows } = await svc.process({
      caller_email: "mallory@example.com",
      caller_name: "Mallory",
      caller_sub: "auth0|mallory",
      other: "from input",
    });

    expect(rows).toEqual([
      {
        email: "ada@example.com",
        name: "Ada",
        sub: "auth0|ada",
        other: "from input",
      },
    ]);
  });

  const OWNER = {
    userId: "auth0|owner",
    username: "Owner",
    email: "owner@club.example",
    idToken: "t",
  };

  /** The service as its runtime calls it inside a run a coordinator handed over. */
  function createInRun(user: unknown, caller: unknown) {
    const { svc, app } = create({
      database: uniqueName(),
      mode: "query",
      statement: WHOAMI,
    });
    (app as any).getAuthenticatedUser = () => user;
    let run: unknown = { requestId: "r", runId: "run-1", caller };
    (app as any).currentContext = () => run;
    return {
      svc,
      /** The call has given up control and another run reached the service. */
      overtakenBy: (next: unknown) => {
        run = next;
      },
    };
  }

  it("are whoever the run says began it, not whoever's browser it runs in", async () => {
    const { svc } = createInRun(OWNER, {
      sub: "auth0|anna",
      email: "anna@example.com",
      name: "Anna",
    });

    const { rows } = await svc.process({ caller_email: OWNER.email });

    expect(rows).toEqual([
      { email: "anna@example.com", name: "Anna", sub: "auth0|anna", other: null },
    ]);
  });

  it("are NULL in a run that arrived naming nobody, though somebody is signed in here", async () => {
    // A timer on another runtime, a request at a mount: nobody began it, and
    // the owner whose browser runs the statement did not either.
    const { svc } = createInRun(OWNER, null);

    const { rows } = await svc.process({});

    expect(rows).toEqual([{ email: null, name: null, sub: null, other: null }]);
  });

  it("are read when the call begins, and kept while it waits", async () => {
    const run = createInRun(OWNER, { sub: "auth0|anna", email: "anna@example.com" });

    // Opening the database is awaited; by the time the statement runs, the
    // service has been reached by a run of somebody else's.
    const answer = run.svc.process({});
    run.overtakenBy({ requestId: "r", runId: "run-2", caller: { sub: "auth0|ben" } });

    expect((await answer).rows[0]).toMatchObject({ sub: "auth0|anna" });
  });

  it("are NULL when nobody is signed in, whatever the input says", async () => {
    const svc = createAs(null);

    const { rows } = await svc.process({
      caller_email: "mallory@example.com",
      caller_sub: "auth0|mallory",
    });

    expect(rows).toEqual([{ email: null, name: null, sub: null, other: null }]);
  });
});
