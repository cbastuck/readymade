import { BoardDocuments } from "./boardPersistence";

/**
 * A board as it was last seen running, kept so an unsaved board survives a
 * reload. Keyed by board name, which on the web is the name in the URL — a
 * sketch at `/playground/<name>` comes back at the same address.
 *
 * Written from the board's snapshots (see core/boardSnapshots), never by a
 * person: saving is what makes a board a saved board, and deletes its draft.
 */
export type BoardDraft = {
  boardName: string;
  /** When the draft was written, ISO 8601. */
  updatedAt: string;
  documents: BoardDocuments;
};

export type DraftSummary = Pick<BoardDraft, "boardName" | "updatedAt">;

/** Where drafts are kept. IndexedDB in a browser, a Map in tests. */
export type DraftBackend = {
  get: (boardName: string) => Promise<BoardDraft | undefined>;
  put: (draft: BoardDraft) => Promise<void>;
  delete: (boardName: string) => Promise<void>;
  all: () => Promise<BoardDraft[]>;
};

export type DraftStore = {
  save: (boardName: string, documents: BoardDocuments) => Promise<void>;
  load: (boardName: string) => Promise<BoardDraft | undefined>;
  remove: (boardName: string) => Promise<void>;
  /** Newest first. */
  list: () => Promise<DraftSummary[]>;
};

export type DraftLimits = {
  /** How many drafts are kept, newest first. */
  maxCount: number;
  /** How old a draft may get before it is dropped. */
  maxAgeMs: number;
};

const DEFAULT_LIMITS: DraftLimits = {
  maxCount: 20,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Drafts over a backend, bounded.
 *
 * Bounded because every visit to the playground without a board name makes a
 * new one, so drafts accumulate without anybody deciding to keep them. Pruned
 * on each write, which is when there is one more.
 *
 * Every operation fails soft: a draft is a safety net, and a browser that keeps
 * no site data (a private window, blocked storage) must still run the board.
 *
 * Operations run one after the other, in the order they were asked for: a save
 * that deletes a draft must not be overtaken by a draft written just before it.
 */
export function createDraftStore(
  backend: DraftBackend,
  limits: DraftLimits = DEFAULT_LIMITS,
  now: () => number = () => Date.now(),
): DraftStore {
  let queue: Promise<unknown> = Promise.resolve();
  const soft = <T>(what: string, run: () => Promise<T>, fallback: T) => {
    const result = queue.then(async () => {
      try {
        return await run();
      } catch (err) {
        console.warn(`Board drafts: could not ${what}`, err);
        return fallback;
      }
    });
    queue = result;
    return result;
  };

  const prune = async () => {
    const drafts = (await backend.all()).sort(newestFirst);
    const cutoff = now() - limits.maxAgeMs;
    const stale = drafts.filter(
      (draft, index) =>
        index >= limits.maxCount || Date.parse(draft.updatedAt) < cutoff,
    );
    for (const draft of stale) {
      await backend.delete(draft.boardName);
    }
  };

  return {
    save: (boardName, documents) =>
      soft(
        "save a draft",
        async () => {
          await backend.put({
            boardName,
            updatedAt: new Date(now()).toISOString(),
            documents,
          });
          await prune();
        },
        undefined,
      ),
    load: (boardName) =>
      soft("read a draft", () => backend.get(boardName), undefined),
    remove: (boardName) =>
      soft("delete a draft", () => backend.delete(boardName), undefined),
    list: () =>
      soft(
        "list drafts",
        async () =>
          (await backend.all())
            .sort(newestFirst)
            .map(({ boardName, updatedAt }) => ({ boardName, updatedAt })),
        [],
      ),
  };
}

function newestFirst(a: DraftSummary, b: DraftSummary): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

const DB_NAME = "hkp-board-drafts";
const STORE = "drafts";

/**
 * IndexedDB rather than localStorage: a board holding data — a canvas, a picked
 * file — can outgrow the few megabytes localStorage has, and that quota is
 * shared with the saved boards, whose saves would then fail too.
 */
export function indexedDbDraftBackend(): DraftBackend {
  let opened: Promise<IDBDatabase> | null = null;
  const db = () => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: "boardName" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // A failed open is retried next time rather than remembered.
    opened.catch(() => {
      opened = null;
    });
    return opened;
  };

  const run = async <T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> => {
    const transaction = (await db()).transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    return new Promise<T>((resolve, reject) => {
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };

  return {
    get: (boardName) => run("readonly", (store) => store.get(boardName)),
    put: (draft) => run("readwrite", (store) => store.put(draft)),
    delete: (boardName) => run("readwrite", (store) => store.delete(boardName)),
    all: () => run("readonly", (store) => store.getAll()),
  };
}

let browserDrafts: DraftStore | null = null;

/** The drafts this browser keeps, shared by the playground and the start page. */
export function browserDraftStore(): DraftStore {
  browserDrafts ??= createDraftStore(indexedDbDraftBackend());
  return browserDrafts;
}
