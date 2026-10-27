import { describe, expect, it } from "vitest";
import { BoardDescriptor } from "../types";
import { describeProposal, diffHunks, lineDiff } from "./proposalDiff";

const board = (patch: Partial<BoardDescriptor> = {}): BoardDescriptor => ({
  boardName: "Board",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" },
    { id: "node", name: "Node", type: "rest" },
  ],
  services: {
    ui: [
      { uuid: "timer", serviceId: "timer", serviceName: "Timer", state: { periodValue: 1 } },
      { uuid: "monitor", serviceId: "monitor", serviceName: "Monitor" },
    ],
    node: [],
  },
  ...patch,
} as BoardDescriptor);

describe("lineDiff", () => {
  it("aligns what both sides share and marks the rest", () => {
    expect(lineDiff("a\nb\nc\nd", "a\nc\nx\nd")).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "same", text: "c" },
      { kind: "added", text: "x" },
      { kind: "same", text: "d" },
    ]);
  });

  it("finds no change in identical text", () => {
    expect(lineDiff("a\nb", "a\nb").every((line) => line.kind === "same")).toBe(true);
  });
});

describe("diffHunks", () => {
  it("keeps context around each change and folds the unchanged lines between", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const after = [...before];
    after[2] = "changed 2";
    after[17] = "changed 17";
    const hunks = diffHunks(lineDiff(before.join("\n"), after.join("\n")), 1);
    expect(hunks.map((hunk) => hunk.kind)).toEqual([
      "folded",
      "lines",
      "folded",
      "lines",
      "folded",
    ]);
    expect(hunks[1].lines.map((line) => line.text)).toEqual([
      "line 1",
      "line 2",
      "changed 2",
      "line 3",
    ]);
    expect(hunks[2].lines).toHaveLength(12);
    expect(hunks[4].lines.map((line) => line.text)).toEqual(["line 19"]);
  });
});

describe("describeProposal", () => {
  it("says nothing of a board that does not change", () => {
    expect(describeProposal(board(), board())).toEqual([]);
  });

  it("names services added, removed, changed and reordered, by uuid", () => {
    const proposed = board({
      services: {
        ui: [
          { uuid: "monitor", serviceId: "monitor", serviceName: "Monitor" },
          { uuid: "timer", serviceId: "timer", serviceName: "Timer", state: { periodValue: 5 } },
          { uuid: "map", serviceId: "map", serviceName: "Map" },
        ],
        node: [],
      },
    } as Partial<BoardDescriptor>);
    expect(describeProposal(board(), proposed)).toEqual([
      "Changes Timer in Browser",
      "Adds Map to Browser",
      "Reorders the services in Browser",
    ]);
  });

  it("names runtimes added, removed and renamed, and what a new one holds", () => {
    const proposed = board({
      runtimes: [
        { id: "ui", name: "Phone", type: "browser" },
        { id: "py", name: "Python", type: "rest" },
      ],
      services: {
        ui: board().services.ui,
        py: [{ uuid: "llm", serviceId: "llm", serviceName: "LLM" }],
      },
    } as Partial<BoardDescriptor>);
    expect(describeProposal(board(), proposed)).toEqual([
      "Removes runtime Node",
      "Renames runtime Browser to Phone",
      "Adds runtime Python",
      "Puts LLM in Python",
    ]);
  });

  it("names the board's other parts when they change", () => {
    const proposed = board({
      boardName: "Renamed",
      facade: { layout: "single", panels: [] },
    } as Partial<BoardDescriptor>);
    expect(describeProposal(board(), proposed)).toEqual([
      "Renames the board to “Renamed”",
      "Adds the facade",
    ]);
  });
});
