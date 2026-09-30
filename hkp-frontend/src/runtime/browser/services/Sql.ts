/**
 * Service Documentation
 * Service ID: sql
 * Service Name: SQL
 * Runtime: browser
 * Modes: query | run | exec
 * Key Config: statement, schema, mode, emit, database
 * IO: in=JSON (the statement's named parameters) -> out=JSON
 *     query -> { rows, count }
 *     run   -> { changes, lastInsertRowid }
 *     exec  -> { executed: true }
 *
 * The browser implementation of the `sql` service hkp-node also provides,
 * sharing its state contract and its results, so a board moves its tables
 * between runtimes by moving the service. Both are SQLite, so the statements
 * move with it unchanged.
 *
 * What differs is where the tables live. Here they belong to this browser:
 * kept in its IndexedDB, seen by nobody else, and gone with the site's data.
 * hkp-node's belong to a tenant on a server, which is what a board needs when
 * several people must see the same rows. See `sql-database.ts`.
 *
 * `database` names the tables, and services naming the same one share them —
 * across boards too, since the browser has no tenants to keep them apart.
 * Left empty, it is `default`: a browser service does not know the title of
 * the board it is on, which is what hkp-node derives the name from.
 *
 * **Parameters come from the input, named by the statement.** A statement
 * mentioning `$conversationId` is given the input's `conversationId`, and a
 * board writes no parameter list at all. Values are always bound, never
 * interpolated.
 *
 * **What it hands onward is separate from what it did.** By default the result
 * travels. `emit: "input"` passes the input through untouched instead, so
 * several statements can act on one request in turn. The result is reported
 * either way.
 */
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import ServiceBase from "./ServiceBase";
import SqlUI from "./SqlUI";
import { EMITS, MODES, SqlEmit, SqlMode } from "./sql-modes";
import {
  DEFAULT_DATABASE,
  Database,
  SqlParams,
  SqlValue,
  sqlDatabases,
  sqliteMessage,
} from "./sql-database";

const serviceId = "sql";
const serviceName = "SQL";

type State = {
  mode: SqlMode;
  emit: SqlEmit;
  database: string;
  statement: string;
  schema: string;
};

/** `$name`, `:name` and `@name` are all named parameters to SQLite. */
const NAMED_PARAMETER = /[$:@]([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * The statement with its literals and comments blanked out.
 *
 * A parameter is only a parameter in code. `'a@x'` is an email address, and
 * scanning the raw text would read `@x` as a parameter, bind a value SQLite
 * never asked for, and fail the statement.
 */
function code(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, " ")
    .replace(/"(?:[^"]|"")*"/g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * A value SQLite can store. Booleans and objects have no column type, and a
 * board should not have to convert them by hand on the way in.
 */
function bindable(value: unknown): SqlValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  return JSON.stringify(value);
}

class Sql extends ServiceBase<State> {
  /** Databases whose schema this instance has already applied. */
  private prepared = new Set<string>();

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      mode: "query",
      emit: "result",
      database: "",
      statement: "",
      schema: "",
    });
  }

  configure(config: any): void {
    if (
      typeof config.mode === "string" &&
      MODES.includes(config.mode as SqlMode) &&
      config.mode !== this.state.mode
    ) {
      this.state.mode = config.mode as SqlMode;
      this.app.notify(this, { mode: this.state.mode });
    }
    if (
      typeof config.emit === "string" &&
      EMITS.includes(config.emit as SqlEmit) &&
      config.emit !== this.state.emit
    ) {
      this.state.emit = config.emit as SqlEmit;
      this.app.notify(this, { emit: this.state.emit });
    }
    if (
      typeof config.statement === "string" &&
      needsUpdate(config.statement, this.state.statement)
    ) {
      this.state.statement = config.statement;
      this.app.notify(this, { statement: this.state.statement });
    }
    if (
      typeof config.schema === "string" &&
      needsUpdate(config.schema, this.state.schema)
    ) {
      this.state.schema = config.schema;
      // A changed schema is a different set of tables to bring into being.
      this.prepared.clear();
      this.app.notify(this, { schema: this.state.schema });
    }
    if (typeof config.database === "string") {
      const database = config.database.trim();
      if (database !== this.state.database) {
        this.state.database = database;
        this.app.notify(this, { database: this.state.database });
      }
    }
  }

  /**
   * Runs the statement and hands onward whatever `emit` says travels.
   *
   * Asynchronous only the first time a database is opened, which loads the
   * engine and reads the database back from storage; after that SQLite answers
   * inside the call.
   */
  async process(input: any): Promise<any> {
    const { mode, statement, emit } = this.state;
    if (!statement.trim() && mode !== "exec") {
      return this.fail("sql has no statement to run");
    }

    const name = this.state.database || DEFAULT_DATABASE;
    let db: Database;
    try {
      db = await sqlDatabases().open(name);
      this.applySchema(db, name);
    } catch (err) {
      return this.fail(
        `could not open the board's database: ${sqliteMessage(err)}`,
      );
    }

    try {
      const result = this.execute(db, input);
      // Reported either way: what the statement did is this service's own
      // news. Only what travels to the next service is `emit`'s to decide.
      this.app.notify(this, result);
      return emit === "input" ? input : result;
    } catch (err) {
      return this.fail(`${this.state.mode} failed: ${sqliteMessage(err)}`);
    }
  }

  /**
   * Creates the board's tables, once per database, before anything reads
   * them. Written with `IF NOT EXISTS`, since the database may have been kept
   * from an earlier run.
   */
  private applySchema(db: Database, name: string): void {
    if (!this.state.schema.trim() || this.prepared.has(name)) {
      return;
    }
    db.exec(this.state.schema);
    this.prepared.add(name);
  }

  private execute(db: Database, input: unknown): Record<string, unknown> {
    const { mode, statement, schema } = this.state;
    if (mode === "exec") {
      db.exec(statement || schema);
      return { executed: true };
    }

    const params = this.parameters(input);
    if (mode === "run") {
      return db.run(statement, params);
    }

    const rows = db.query(statement, params);
    return { rows, count: rows.length };
  }

  /**
   * The values the statement asks for, taken from the input by name, keyed as
   * the statement writes them (`$day`), which is how the engine binds them.
   *
   * Only the names the statement mentions are bound: SQLite rejects a
   * parameter it was not asked for.
   */
  private parameters(input: unknown): SqlParams {
    const record =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const params: SqlParams = {};
    for (const match of code(this.state.statement).matchAll(NAMED_PARAMETER)) {
      params[match[0]] = bindable(record[match[1]]);
    }
    return params;
  }

  /** Reports a failure and produces nothing, so the pipeline stops here. */
  private fail(error: string): null {
    this.app.log(this, "error", "service.failed", { message: error });
    this.app.notify(this, { error });
    return null;
  }
}

export default {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Sql(app, board, descriptor, id),
  createUI: SqlUI,
};
