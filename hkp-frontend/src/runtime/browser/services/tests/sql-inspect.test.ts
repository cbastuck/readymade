import { describe, expect, it, vi } from "vitest";

import SqlDescriptor from "../Sql";
import { tableUse } from "../sql-inspect";

/**
 * Looking into a SQL service's database from its panel, against the real
 * engine. The page's databases are shared by name, so every test names its own.
 */

let counter = 0;
const uniqueName = () => `inspect-${Date.now()}-${++counter}`;

function create(state: Record<string, unknown>) {
  const app = { notify: vi.fn(), log: vi.fn(), next: vi.fn(), sendAction: vi.fn() };
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

/** A database holding `fold` (three rows), `story_fold` (empty) and a view. */
async function seeded() {
  const database = uniqueName();
  const { svc: setup } = create({
    database,
    mode: "exec",
    statement: `
      CREATE TABLE fold (story INTEGER, comment INTEGER, collapsed INTEGER);
      CREATE TABLE story_fold (story INTEGER PRIMARY KEY, collapse_all INTEGER);
      CREATE TABLE "odd ""name""" (x TEXT);
      CREATE VIEW folded AS SELECT * FROM fold WHERE collapsed = 1;
      INSERT INTO fold VALUES (1, 10, 1), (1, 11, 0), (2, 20, NULL);
    `,
  });
  await setup.process({});
  return database;
}

describe("what a statement does with a table", () => {
  it("writes what follows INSERT INTO, REPLACE INTO, UPDATE and DELETE FROM", () => {
    expect(tableUse("fold", "INSERT INTO fold (story) VALUES (1)")).toBe("writes");
    expect(tableUse("fold", "insert or replace into fold values (1)")).toBe("writes");
    expect(tableUse("fold", "REPLACE INTO fold VALUES (1)")).toBe("writes");
    expect(tableUse("fold", "UPDATE fold SET collapsed = 0")).toBe("writes");
    expect(tableUse("fold", "DELETE FROM fold WHERE story = 1")).toBe("writes");
    expect(tableUse("odd name", 'DELETE FROM "odd name"')).toBe("writes");
  });

  it("reads any other table it names", () => {
    const statement =
      "INSERT INTO fold SELECT story, 1, 1 FROM story_fold JOIN rank ON 1";
    expect(tableUse("story_fold", statement)).toBe("reads");
    expect(tableUse("rank", statement)).toBe("reads");
  });

  it("does not take a longer name, a comment or a value for the table", () => {
    expect(tableUse("fold", "SELECT * FROM story_fold")).toBeNull();
    expect(tableUse("fold", "SELECT * FROM folds")).toBeNull();
    expect(tableUse("fold", "SELECT 1 -- from fold\n")).toBeNull();
    expect(tableUse("fold", "SELECT 'fold'")).toBeNull();
  });
});

describe("inspecting a SQL service's database", () => {
  it("lists every table and view, the ones the statement uses first", async () => {
    const database = await seeded();
    const { svc } = create({
      database,
      mode: "query",
      statement: "SELECT * FROM story_fold s JOIN fold f ON f.story = s.story",
    });

    const found = await svc.inspectTables();

    expect(found.database).toBe(database);
    expect(
      found.tables.map((t: any) => [t.name, t.type, t.rows, t.use]),
    ).toEqual([
      ["fold", "table", 3, "reads"],
      ["story_fold", "table", 0, "reads"],
      ["folded", "view", null, null],
      ['odd "name"', "table", 0, null],
    ]);
    expect(found.tables[0].sql).toContain("CREATE TABLE fold");
  });

  it("puts a table the statement writes before one it reads", async () => {
    const database = await seeded();
    const { svc } = create({
      database,
      mode: "run",
      statement: "INSERT INTO story_fold SELECT story, 1 FROM fold",
    });

    const found = await svc.inspectTables();
    expect(found.tables.slice(0, 2).map((t: any) => [t.name, t.use])).toEqual([
      ["story_fold", "writes"],
      ["fold", "reads"],
    ]);
  });

  it("reads a table a page at a time, with the total", async () => {
    const database = await seeded();
    const { svc } = create({ database, mode: "query", statement: "SELECT 1" });

    expect(await svc.inspectRows("fold", 0, 2)).toEqual({
      columns: ["story", "comment", "collapsed"],
      rows: [
        [1, 10, 1],
        [1, 11, 0],
      ],
      total: 3,
    });
    expect((await svc.inspectRows("fold", 2, 2)).rows).toEqual([[2, 20, null]]);
    expect(await svc.inspectRows("folded", 0, 10)).toMatchObject({
      rows: [[1, 10, 1]],
      total: 1,
    });
  });

  it("shows an empty table's columns, and reads a name that needs quoting", async () => {
    const database = await seeded();
    const { svc } = create({ database, mode: "query", statement: "SELECT 1" });

    expect(await svc.inspectRows('odd "name"', 0, 10)).toEqual({
      columns: ["x"],
      rows: [],
      total: 0,
    });
  });

  it("refuses a table that is not there rather than reading something else", async () => {
    const database = await seeded();
    const { svc } = create({ database, mode: "query", statement: "SELECT 1" });

    await expect(svc.inspectRows("fold; DROP TABLE fold", 0, 10)).rejects.toThrow(
      /no table/,
    );
    expect((await svc.inspectRows("fold", 0, 10)).total).toBe(3);
  });

  it("is read only and says nothing to the board: no schema, no notice, nothing onward", async () => {
    const database = uniqueName();
    const { svc, app } = create({
      database,
      mode: "query",
      schema: "CREATE TABLE IF NOT EXISTS made_by_schema (x INTEGER);",
      statement: "SELECT * FROM made_by_schema",
    });

    const found = await svc.inspectTables();

    expect(found.tables).toEqual([]);
    expect(app.notify).not.toHaveBeenCalled();
    expect(app.next).not.toHaveBeenCalled();
  });
});
