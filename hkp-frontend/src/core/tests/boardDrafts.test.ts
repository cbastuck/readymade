import { describe, expect, it } from "vitest";

import { BoardDraft, DraftBackend, createDraftStore } from "../boardDrafts";
import { BoardDocuments } from "../boardPersistence";

function memoryBackend(): DraftBackend & { drafts: Map<string, BoardDraft> } {
  const drafts = new Map<string, BoardDraft>();
  return {
    drafts,
    get: async (name) => drafts.get(name),
    put: async (draft) => {
      drafts.set(draft.boardName, draft);
    },
    delete: async (name) => {
      drafts.delete(name);
    },
    all: async () => [...drafts.values()],
  };
}

const documents = (value: number): BoardDocuments => ({
  composition: { runtimes: [], services: {}, value } as any,
  units: [],
});

const DAY = 24 * 60 * 60 * 1000;

describe("createDraftStore", () => {
  it("keeps a draft per board name, the latest write winning", async () => {
    const backend = memoryBackend();
    const store = createDraftStore(backend);
    await store.save("sketch", documents(1));
    await store.save("sketch", documents(2));

    const draft = await store.load("sketch");
    expect((draft?.documents.composition as any).value).toBe(2);
    expect(backend.drafts.size).toBe(1);
  });

  it("drops the oldest drafts beyond the limit, and those too old", async () => {
    let clock = 100 * DAY;
    const store = createDraftStore(
      memoryBackend(),
      { maxCount: 2, maxAgeMs: 30 * DAY },
      () => clock,
    );
    await store.save("a", documents(1));
    clock += DAY;
    await store.save("b", documents(1));
    clock += DAY;
    await store.save("c", documents(1));
    expect((await store.list()).map((d) => d.boardName)).toEqual(["c", "b"]);

    clock += 31 * DAY;
    await store.save("d", documents(1));
    expect((await store.list()).map((d) => d.boardName)).toEqual(["d"]);
  });

  it("runs operations in the order they were asked for", async () => {
    const store = createDraftStore(memoryBackend());
    // Not awaited in between: a save's delete must not overtake a pending write.
    void store.save("sketch", documents(1));
    const removed = store.remove("sketch");
    await removed;

    expect(await store.load("sketch")).toBeUndefined();
  });

  it("fails soft when the backend does", async () => {
    const failing: DraftBackend = {
      get: () => Promise.reject(new Error("no storage")),
      put: () => Promise.reject(new Error("no storage")),
      delete: () => Promise.reject(new Error("no storage")),
      all: () => Promise.reject(new Error("no storage")),
    };
    const store = createDraftStore(failing);

    await expect(store.save("x", documents(1))).resolves.toBeUndefined();
    await expect(store.load("x")).resolves.toBeUndefined();
    await expect(store.list()).resolves.toEqual([]);
  });
});
