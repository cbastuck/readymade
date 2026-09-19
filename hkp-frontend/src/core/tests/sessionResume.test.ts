import { describe, expect, it, vi } from "vitest";

import { UnitBoard } from "../../runtime/board/units";
import { unlinkBoardDocuments } from "../boardPersistence";
import { filesUnitOrigin, linkBoard } from "../linkUnits";
import { BoardDescriptor } from "../../types";
import { FacadeDescriptor } from "../../facade/types";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

function facadeOf(title: string): FacadeDescriptor {
  return {
    layout: "single",
    panels: [{ id: "main", title, layout: { direction: "column", items: [] } }],
  };
}

function unit(name: string): UnitBoard {
  return {
    boardName: `Unit ${name}`,
    unit: { name },
    runtimes: [
      { id: "node", name: "Node", type: "rest", url: "http://127.0.0.1:8080" },
    ],
    services: { node: [] },
    facade: facadeOf(name),
  };
}

/** A composition with no facade of its own — its faces come from its units. */
const composition: UnitBoard = {
  boardName: "Reading Radio",
  runtimes: [],
  services: {},
  units: [{ uri: "reader.json", as: "reader" }, { uri: "radio.json", as: "radio" }],
};

const documents = {
  "reader.json": unit("reader"),
  "radio.json": unit("radio"),
};

const origin = filesUnitOrigin(new Map(Object.entries(documents)));

/** What the board is once it runs: the state a snapshot is taken from. */
async function running(board: UnitBoard) {
  const projection = await linkBoard(board, origin);
  return {
    board: {
      boardName: projection.board.boardName,
      runtimes: projection.board.runtimes,
      services: projection.board.services,
      facade: projection.board.facade,
    } as BoardDescriptor,
    linkage: { units: projection.units, views: projection.views },
  };
}

describe("resuming a session", () => {
  it("gives a composition back the units it was assembled from", async () => {
    const { board, linkage } = await running(composition);
    expect(linkage.views.map((view) => view.id)).toEqual(["reader", "radio"]);

    const stored = unlinkBoardDocuments(board, linkage);

    // What is stored is a document, not the flat board that was running.
    expect(stored.composition.units?.map((entry) => entry.uri)).toEqual([
      "reader.json",
      "radio.json",
    ]);
    expect(stored.composition.runtimes).toEqual([]);
    expect(stored.units.map((entry) => entry.uri)).toEqual([
      "reader.json",
      "radio.json",
    ]);
  });

  it("restores the faces its units contribute", async () => {
    const { board, linkage } = await running(composition);
    const stored = unlinkBoardDocuments(board, linkage);

    // Resumed with nothing but what was stored: no URL, no files, no library.
    const carried = filesUnitOrigin(
      new Map(stored.units.map((entry) => [entry.uri, entry.board])),
    );
    const resumed = await linkBoard(stored.composition, carried);

    expect(resumed.views.map((view) => view.id)).toEqual(["reader", "radio"]);
    expect(resumed.views.map((view) => view.facade.panels[0].title)).toEqual([
      "reader",
      "radio",
    ]);
  });

  it("restores the same board rather than one runtime twice over", async () => {
    const { board, linkage } = await running(composition);
    const stored = unlinkBoardDocuments(board, linkage);
    const carried = filesUnitOrigin(
      new Map(stored.units.map((entry) => [entry.uri, entry.board])),
    );
    const resumed = await linkBoard(stored.composition, carried);

    expect(resumed.board.runtimes.map((rt) => rt.id)).toEqual(
      board.runtimes.map((rt) => rt.id),
    );
    expect(resumed.board.runtimes.map((rt) => rt.id)).toEqual([
      "reader.node",
      "radio.node",
    ]);
  });

  it("has nothing to link when the flat board is stored on its own", async () => {
    // The bug this guards: a projection declares no units, so re-opening one
    // leaves the board with no views and only its board half to look at.
    const { board } = await running(composition);
    const reopened = await linkBoard(board as UnitBoard, origin);
    expect(reopened.views).toEqual([]);
    expect(reopened.board.facade).toBeUndefined();
  });

  it("stores an ordinary board as itself, facade and all", async () => {
    const plain: UnitBoard = {
      boardName: "Plain",
      runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
      services: { ui: [] },
      facade: facadeOf("plain"),
    };
    const { board, linkage } = await running(plain);

    const stored = unlinkBoardDocuments(board, linkage);
    expect(stored.units).toEqual([]);
    expect(stored.composition.facade).toEqual(facadeOf("plain"));
    expect(stored.composition.runtimes.map((rt) => rt.id)).toEqual(["ui"]);
  });
});
