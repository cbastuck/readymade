/**
 * SQL databases for the browser runtime, by name.
 *
 * The browser's counterpart to hkp-node's `database.ts`: the same surface —
 * exec, query, run — over SQLite compiled to WebAssembly
 * (`@sqlite.org/sqlite-wasm`) instead of `node:sqlite`, so a statement written
 * for one runs unchanged on the other.
 *
 * A database lives in memory while the page runs, and is kept as a snapshot of
 * the whole file in IndexedDB: written in the task after anything changes it,
 * then read back the next time the name is opened. A snapshot rather than a
 * file system underneath, because the only storage SQLite can write in place
 * (OPFS) needs a worker, and a worker would make every statement a message
 * round trip. The costs: a write reaches IndexedDB a moment after the
 * statement returns, every changing pass writes the whole database, and two
 * pages holding the same database each keep their own copy — the last one to
 * write it wins.
 *
 * The engine (~900 KB of WebAssembly) is loaded on the first open, so a board
 * without an SQL service never downloads it.
 */
import type {
  Database as WasmDatabase,
  Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";

/** Values SQLite can store, and therefore what a statement may be given. */
export type SqlValue = string | number | bigint | null | Uint8Array;

/** Named parameters, keyed as the statement writes them: `$day`, `:day`, `@day`. */
export type SqlParams = Record<string, SqlValue>;

export type SqlRow = Record<string, unknown>;

export type Database = {
  /** Statements run for their effect: DDL, PRAGMA, several at once. */
  exec(sql: string): void;
  /** The rows a statement returns. */
  query(sql: string, params?: SqlParams): SqlRow[];
  /** A statement that changes rows. */
  run(
    sql: string,
    params?: SqlParams,
  ): { changes: number; lastInsertRowid: number };
};

/** Where a database's bytes are kept between page loads. */
export type SqlPersistence = {
  load(name: string): Promise<Uint8Array | undefined>;
  save(name: string, bytes: Uint8Array): Promise<void>;
};

export type DatabaseStore = {
  /** The database of this name, opened on first use and kept open. */
  open(name: string): Promise<Database>;
  /** Writes every database changed since it was last kept. */
  flush(): Promise<void>;
  /** Keeps what changed, then closes every open database. For tests. */
  closeAll(): Promise<void>;
};

/** What a service with no `database` of its own opens. */
export const DEFAULT_DATABASE = "default";

/**
 * Names reserved by hkp-node, where `shared` holds the owner's queue. Refused
 * here too, so a board valid in one runtime is valid in the other.
 */
const RESERVED_NAMES = new Set(["shared"]);

/**
 * A board-chosen database name, or an explanation of why it is not one. The
 * same rule hkp-node applies, where the name becomes a file name.
 */
export function checkDatabaseName(name: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
    return `'${name}' is not a database name: use 1-64 characters from A-Z, a-z, 0-9, - and _`;
  }
  if (RESERVED_NAMES.has(name.toLowerCase())) {
    return `'${name}' is reserved by the runtime`;
  }
  return null;
}

// ── Engine ──────────────────────────────────────────────────────────────────

let engine: Promise<Sqlite3Static> | null = null;

function loadEngine(): Promise<Sqlite3Static> {
  if (!engine) {
    engine = import("@sqlite.org/sqlite-wasm")
      .then(async (mod) => {
        const init = mod.default as unknown as (
          moduleArg?: object,
        ) => Promise<Sqlite3Static>;
        const sqlite3 = await init({
          print: () => {},
          printErr: (...args: unknown[]) => console.debug("[sqlite]", ...args),
        });
        // A failing statement is also announced on the console; the service
        // reports it itself, with the statement that failed.
        try {
          sqlite3.config.warn = (...args: unknown[]) =>
            console.debug("[sqlite]", ...args);
        } catch {
          // A frozen config only costs a duplicate console line.
        }
        return sqlite3;
      })
      .catch((err) => {
        // Let the next open try again rather than failing forever.
        engine = null;
        throw err;
      });
  }
  return engine;
}

// ── Values ──────────────────────────────────────────────────────────────────

/**
 * A column value as JSON can carry it.
 *
 * SQLite integers beyond 2^53 arrive as `bigint`, which the rest of a board
 * cannot serialise. A safe one becomes a number, as it would from hkp-node;
 * one beyond that becomes its decimal string rather than a rounded number.
 */
function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  return value;
}

/** Rows as plain objects: the engine hands them out without a prototype. */
function plainRow(row: Record<string, unknown>): SqlRow {
  const plain: SqlRow = {};
  for (const key of Object.keys(row)) {
    plain[key] = jsonValue(row[key]);
  }
  return plain;
}

/**
 * The engine's message without its result-code preamble —
 * `SQLITE_CONSTRAINT_UNIQUE: sqlite3 result code 2067: UNIQUE constraint failed`
 * reads as what hkp-node says, `UNIQUE constraint failed`. A trigger's
 * `RAISE(ABORT, '…')` text is what a board shows its users, so the preamble
 * would otherwise end up on screen.
 */
export function sqliteMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/^SQLITE_[A-Z_]+: sqlite3 result code \d+: /, "");
}

// ── Databases ───────────────────────────────────────────────────────────────

type Handle = {
  sqlite3: Sqlite3Static;
  db: WasmDatabase;
  wrapped: Database;
  /** Changed since it was last kept. */
  dirty: boolean;
};

function openWasmDatabase(
  sqlite3: Sqlite3Static,
  bytes: Uint8Array | undefined,
): WasmDatabase {
  const db = new sqlite3.oo1.DB(":memory:", "c");
  if (bytes && bytes.byteLength > 0) {
    const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
    const rc = sqlite3.capi.sqlite3_deserialize(
      db.pointer!,
      "main",
      pointer,
      bytes.byteLength,
      bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
        sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    db.checkRc(rc);
  }
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function wrap(
  sqlite3: Sqlite3Static,
  db: WasmDatabase,
  changed: () => void,
): Database {
  /**
   * What moves when the database does: rows changed, and the schema's version,
   * since a statement that only creates or drops something changes no rows.
   */
  const revision = () =>
    `${sqlite3.capi.sqlite3_total_changes(db)}:${db.selectValue("PRAGMA schema_version")}`;

  /** Runs `fn` and marks the database changed if it was. */
  const tracked = <T>(fn: () => T): T => {
    const before = revision();
    try {
      return fn();
    } finally {
      if (revision() !== before) {
        changed();
      }
    }
  };

  // A statement with nothing to bind is given nothing: the engine refuses an
  // empty binding for a statement that has no parameters.
  const bindOf = (params?: SqlParams) =>
    params && Object.keys(params).length > 0 ? { bind: params } : {};

  return {
    exec: (sql) => tracked(() => void db.exec(sql)),
    query: (sql, params) =>
      tracked(() =>
        (
          db.exec({
            sql,
            ...bindOf(params),
            rowMode: "object",
            returnValue: "resultRows",
          }) as Record<string, unknown>[]
        ).map(plainRow),
      ),
    run: (sql, params) =>
      tracked(() => {
        db.exec({ sql, ...bindOf(params) });
        return {
          changes: db.changes(),
          lastInsertRowid: Number(sqlite3.capi.sqlite3_last_insert_rowid(db)),
        };
      }),
  };
}

export function createDatabaseStore({
  persistence,
  // Written in the task after the change, which still gathers the statements
  // of one pass into one write. Any longer is a window in which leaving the
  // page loses the change: a write started as the page goes away is not
  // reliably finished (measured: half of immediate navigations lost it).
  saveDelayMs = 0,
}: {
  persistence: SqlPersistence | null;
  saveDelayMs?: number;
}): DatabaseStore {
  const open = new Map<string, Promise<Handle>>();
  /** The databases that have finished opening, reachable without waiting. */
  const ready = new Map<string, Handle>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  /**
   * Snapshots every changed database and hands it to persistence.
   *
   * Synchronous up to the hand-over, with no await before it: called from
   * `pagehide`, anything left for a later task may never run. Writes are
   * started in call order, and IndexedDB applies them in the order they were
   * started, so an older snapshot never lands after a newer one.
   */
  const keep = (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!persistence) {
      return writing;
    }
    const saves: Promise<void>[] = [];
    for (const [name, handle] of ready) {
      if (!handle.dirty) {
        continue;
      }
      handle.dirty = false;
      const bytes = handle.sqlite3.capi.sqlite3_js_db_export(handle.db);
      saves.push(
        persistence.save(name, bytes).catch((err) => {
          handle.dirty = true;
          console.warn(`sql: could not keep database '${name}'`, err);
        }),
      );
    }
    if (saves.length > 0) {
      const started = Promise.all(saves);
      writing = writing.then(() => started).then(() => {});
    }
    return writing;
  };

  const scheduleKeep = () => {
    if (!persistence || timer) {
      return;
    }
    timer = setTimeout(() => void keep(), saveDelayMs);
  };

  const openHandle = async (name: string): Promise<Handle> => {
    const sqlite3 = await loadEngine();
    const bytes = persistence ? await persistence.load(name) : undefined;
    const db = openWasmDatabase(sqlite3, bytes);
    const handle: Handle = {
      sqlite3,
      db,
      wrapped: null as unknown as Database,
      dirty: false,
    };
    handle.wrapped = wrap(sqlite3, db, () => {
      handle.dirty = true;
      scheduleKeep();
    });
    ready.set(name, handle);
    return handle;
  };

  return {
    open: async (name) => {
      const wrong = checkDatabaseName(name);
      if (wrong) {
        throw new Error(wrong);
      }
      let pending = open.get(name);
      if (!pending) {
        pending = openHandle(name);
        open.set(name, pending);
        // A failed open is not remembered: the next call tries again.
        pending.catch(() => open.delete(name));
      }
      return (await pending).wrapped;
    },
    flush: keep,
    closeAll: async () => {
      await keep();
      for (const pending of open.values()) {
        const handle = await pending.catch(() => null);
        handle?.db.close();
      }
      open.clear();
      ready.clear();
    },
  };
}

// ── IndexedDB ───────────────────────────────────────────────────────────────

const IDB_NAME = "hkp-sql";
const IDB_STORE = "databases";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Snapshots kept in this origin's IndexedDB, one entry per database name, or
 * null where the page has no IndexedDB — databases then last as long as the
 * page does.
 */
export function indexedDbPersistence(): SqlPersistence | null {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  let connection: Promise<IDBDatabase> | null = null;
  /**
   * The open connection, once there is one. A write through it starts its
   * transaction in the calling task, which is what lets a write started as
   * the page is hidden still happen.
   */
  let connected: IDBDatabase | null = null;
  const connect = () => {
    if (!connection) {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      connection = request(req).then(
        (idb) => {
          connected = idb;
          return idb;
        },
        (err) => {
          connection = null;
          throw err;
        },
      );
    }
    return connection;
  };

  const put = (idb: IDBDatabase, name: string, bytes: Uint8Array) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, name);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  return {
    load: async (name) => {
      const idb = await connect();
      const value = await request(
        idb.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(name),
      );
      return value instanceof Uint8Array ? value : undefined;
    },
    save: (name, bytes) =>
      connected
        ? put(connected, name, bytes)
        : connect().then((idb) => put(idb, name, bytes)),
  };
}

// ── The page's store ────────────────────────────────────────────────────────

let pageStore: DatabaseStore | null = null;

/**
 * The databases of this page, shared by every SQL service in it: two services
 * naming the same database see the same tables.
 */
export function sqlDatabases(): DatabaseStore {
  if (!pageStore) {
    const store = createDatabaseStore({ persistence: indexedDbPersistence() });
    pageStore = store;
    // A page about to go away gets no second chance at a pending write.
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => void store.flush());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          void store.flush();
        }
      });
    }
  }
  return pageStore;
}
