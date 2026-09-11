import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppCtx, AppContextState } from "../../../AppContext";
import { User } from "../../../types";
import { localStoragePrefix } from "../../playground/common";
import { useCloudBoardSources } from "../useCloudBoardSources";
import { BoardNode } from "../types";

/**
 * What a cloud record and the board inside it are called, and who deletes one.
 *
 * A record is listed under its name, so a board opening under a different one
 * would upload back as a second record — the reason the name travels with the
 * document on the way up and on the way down.
 */

const USER: User = {
  username: "someone",
  userId: "auth0|1",
  features: [],
  picture: "",
  email: "someone@example.com",
  idToken: "token-abc",
};

function contextFor(user: User | null): AppContextState {
  return {
    user,
    appViewMode: "wide",
    pushNotification: () => {},
    popNotification: () => {},
    updateToken: async () => {},
    logout: () => {},
    waitForAuthResolved: async () => user,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AppCtx.Provider value={contextFor(USER)}>{children}</AppCtx.Provider>;
}

const SUMMARY = {
  id: "board-1",
  name: "Dummy",
  ownerEmail: "someone@example.com",
  metadata: null,
  hasImage: false,
  role: "owner" as const,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

type Call = [string, RequestInit | undefined];

describe("cloud board identity", () => {
  let calls: Call[];
  /** What GET ?id=… answers with; set per test. */
  let stored: Record<string, unknown>;

  beforeEach(() => {
    calls = [];
    stored = {};
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init]);
        const method = init?.method ?? "GET";
        const body =
          method === "GET" && url.includes("id=")
            ? { ...SUMMARY, data: stored }
            : method === "GET"
              ? { boards: [SUMMARY] }
              : { id: SUMMARY.id, name: SUMMARY.name };
        return { ok: true, status: 200, json: async () => body };
      }),
    );
  });

  const callsOf = (method: string) =>
    calls.filter(([, init]) => (init?.method ?? "GET") === method);

  it("uploads the board inside the saved envelope, under the name it is filed as", async () => {
    // As a save writes it: the board wrapped, and holding the name it had
    // before it was ever saved under this one.
    localStorage.setItem(
      `${localStoragePrefix}Dummy`,
      JSON.stringify({
        source: JSON.stringify({
          boardName: "Playground",
          runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
          services: { ui: [] },
        }),
        description: "A board",
        createdAt: "2026-01-01T00:00:00Z",
      }),
    );

    const { result } = renderHook(() => useCloudBoardSources(), { wrapper });
    await waitFor(() => expect(result.current.uploadBoardToCloud).toBeTruthy());
    await result.current.uploadBoardToCloud!("Dummy");

    const [, init] = callsOf("PUT")[0];
    const sent = JSON.parse(init!.body as string) as {
      name: string;
      data: { boardName?: string; runtimes?: unknown[] };
      metadata?: { description?: string };
    };
    expect(sent.name).toBe("Dummy");
    // The board itself, not the envelope around it.
    expect(sent.data.runtimes).toHaveLength(1);
    expect(sent.data.boardName).toBe("Dummy");
    expect(sent.metadata?.description).toBe("A board");
  });

  it("opens a stored board under the record's name", async () => {
    stored = { boardName: "Playground", runtimes: [], services: {} };

    const { result } = renderHook(() => useCloudBoardSources(), { wrapper });
    const board = await result.current.openCloudStored({
      id: SUMMARY.id,
      name: SUMMARY.name,
    });

    expect(board?.data.boardName).toBe("Dummy");
  });

  it("unwraps a record uploaded as the saved envelope", async () => {
    stored = {
      source: JSON.stringify({
        runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
        services: { ui: [] },
      }),
      createdAt: "2026-01-01T00:00:00Z",
    };

    const { result } = renderHook(() => useCloudBoardSources(), { wrapper });
    const board = await result.current.openCloudStored({
      id: SUMMARY.id,
      name: SUMMARY.name,
    });

    expect(board?.data.runtimes).toHaveLength(1);
    expect(board?.data.boardName).toBe("Dummy");
  });

  it("deletes an uploaded board by its cloud id and re-lists", async () => {
    const { result } = renderHook(() => useCloudBoardSources(), { wrapper });
    await waitFor(() =>
      expect(result.current.uploadedFolders[0]?.children).toHaveLength(1),
    );
    const node = result.current.uploadedFolders[0].children[0] as BoardNode;

    const listedBefore = callsOf("GET").length;
    await result.current.onDeleteCloudBoard(node);

    const [url] = callsOf("DELETE")[0];
    expect(url).toContain(`id=${SUMMARY.id}`);
    // The board is gone from the listing the moment it is gone from the cloud.
    expect(callsOf("GET").length).toBeGreaterThan(listedBefore);
  });
});
