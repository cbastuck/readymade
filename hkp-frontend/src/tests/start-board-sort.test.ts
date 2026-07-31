import { describe, expect, it } from "vitest";

import {
  buildMyBoardsFolder,
  formatModified,
  hasModifiedBoards,
  sortNodes,
} from "../views/start/model";
import { BoardNode, FolderNode, TreeNode } from "../views/start/types";

const board = (name: string, modified?: string): BoardNode => ({
  type: "board",
  name,
  state: "saved",
  modified,
});

const folder = (name: string): FolderNode => ({
  type: "folder",
  name,
  children: [],
});

describe("sortNodes", () => {
  it("orders boards by name, case-insensitively", () => {
    const nodes: TreeNode[] = [board("zulu"), board("Alpha"), board("mike")];
    expect(sortNodes(nodes, "name").map((n) => n.name)).toEqual([
      "Alpha",
      "mike",
      "zulu",
    ]);
  });

  it("orders boards newest first in recent mode", () => {
    const nodes: TreeNode[] = [
      board("old", "2026-01-02T10:00:00Z"),
      board("newest", "2026-07-30T10:00:00Z"),
      board("middle", "2026-05-05T10:00:00Z"),
    ];
    expect(sortNodes(nodes, "recent").map((n) => n.name)).toEqual([
      "newest",
      "middle",
      "old",
    ]);
  });

  it("sorts boards without a timestamp last, by name", () => {
    const nodes: TreeNode[] = [
      board("undated-b"),
      board("dated", "2026-01-02T10:00:00Z"),
      board("undated-a"),
    ];
    expect(sortNodes(nodes, "recent").map((n) => n.name)).toEqual([
      "dated",
      "undated-a",
      "undated-b",
    ]);
  });

  it("leaves folders in their slots", () => {
    const nodes: TreeNode[] = [
      folder("Zeta"),
      board("zulu"),
      folder("Alpha"),
      board("alpha"),
    ];
    expect(sortNodes(nodes, "name").map((n) => n.name)).toEqual([
      "Zeta",
      "alpha",
      "Alpha",
      "zulu",
    ]);
  });
});

describe("hasModifiedBoards", () => {
  it("is false for a source whose boards carry no timestamp", () => {
    expect(hasModifiedBoards([board("Sequencer"), board("Sampler")])).toBe(
      false,
    );
  });

  it("is false for a column of folders alone", () => {
    expect(hasModifiedBoards([folder("Audio"), folder("Canvas")])).toBe(false);
  });

  it("is true once one board reports a timestamp", () => {
    expect(
      hasModifiedBoards([board("Sampler"), board("Mixer", "2026-07-30T10:00:00Z")]),
    ).toBe(true);
  });
});

describe("buildMyBoardsFolder", () => {
  const tree = {
    version: 1 as const,
    items: [
      {
        type: "folder" as const,
        name: "Work",
        children: [{ type: "board" as const, name: "Mixer" }],
      },
    ],
  };

  it("carries the host's timestamps into All Boards and the user folders", () => {
    const myBoards = buildMyBoardsFolder(tree, [
      { name: "Mixer", modified: "2026-07-30T10:00:00Z" },
      { name: "Sampler" },
    ]);

    const allBoards = myBoards.children[0] as FolderNode;
    expect(
      allBoards.children.map((node) => [
        node.name,
        (node as BoardNode).modified,
      ]),
    ).toEqual([
      ["Mixer", "2026-07-30T10:00:00Z"],
      ["Sampler", undefined],
    ]);

    const work = myBoards.children[1] as FolderNode;
    expect((work.children[0] as BoardNode).modified).toBe(
      "2026-07-30T10:00:00Z",
    );
  });

  it("drops filed references whose board no longer exists", () => {
    const myBoards = buildMyBoardsFolder(tree, [{ name: "Sampler" }]);
    expect((myBoards.children[1] as FolderNode).children).toEqual([]);
  });
});

describe("formatModified", () => {
  it("returns undefined for missing and unparseable values", () => {
    expect(formatModified(undefined)).toBeUndefined();
    expect(formatModified("not a date")).toBeUndefined();
  });

  it("formats a valid timestamp", () => {
    expect(formatModified("2026-07-30T10:00:00Z")).toContain("2026");
  });
});
