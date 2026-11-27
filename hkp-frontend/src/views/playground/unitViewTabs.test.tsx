import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { BoardContextState } from "../../BoardContext";

/**
 * The row of tabs a composition is looked at through.
 *
 * It is drawn outside the facade — above it, beside nothing — which is the whole
 * reason this is pinned: everything below it is painted by the facade, so a bar
 * that paints nothing is a strip of whatever the host happens to have behind the
 * board showing between the tabs. It reads as a hole in the page rather than as
 * the top of the facade.
 */

vi.mock("./Board", () => ({ default: () => <div data-testid="board" /> }));
// The board context each render of the facade was handed, newest last.
const handed: BoardContextState[] = [];
vi.mock("../../facade/FacadeRenderer", () => ({
  default: ({
    facade,
    boardContext,
  }: {
    facade: { panels: unknown[] };
    boardContext: BoardContextState;
  }) => {
    handed.push(boardContext);
    return <div data-testid="facade" data-panels={facade.panels.length} />;
  },
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("../../facade/FacadeViewContext", () => ({
  useFacadeView: () => ({ showFacade: true, showRuntime: true, editorOpen: false }),
}));

import BoardEntryPoint from "./BoardEntryPoint";

/** A composition: two units, each contributing one view. */
function contextWithViews(): BoardContextState {
  const view = (id: string, title: string) => ({
    id,
    title,
    unit: id,
    facade: { layout: "single", panels: [{ id: `${id}-panel`, layout: { items: [] } }] },
    runtimeIds: [`${id}.node`],
  });
  return {
    boardName: "Reading Radio",
    runtimes: [{ id: "radio.node" }],
    services: {},
    scopes: {},
    registry: {},
    linkage: { views: [view("radio", "Radio"), view("library", "Radio Library")] },
  } as unknown as BoardContextState;
}

function entryPoint(boardContext: BoardContextState) {
  return (
    <BoardEntryPoint
      isLoading={false}
      showLoginRequired={false}
      boardContext={boardContext}
      description=""
      onChangeBoardname={() => {}}
    />
  );
}

function renderEntryPoint() {
  return render(entryPoint(contextWithViews()));
}

describe("the tabs a composition's views are chosen by", () => {
  it("paints the facade's surface behind them", () => {
    renderEntryPoint();

    const bar = screen.getByRole("tablist");

    // The token names the surface the facade paints, and the value after the
    // comma is what a host that does not define it falls back to — a facade is
    // shown in hosts without the playground's tokens.
    expect(bar.style.background).toBe("hsl(var(--background, 0 0% 100%))");
  });

  it("names one tab per view", () => {
    renderEntryPoint();

    expect(screen.getByRole("tab", { name: "Radio" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Radio Library" })).toBeTruthy();
  });
});

describe("the board a unit's view is handed", () => {
  // The context is a new object on every render of its provider. A view
  // handed fresh runtimes and services each time would read the board's shape
  // each time, which asks every service for its configuration.
  it("keeps its runtimes and services while the board's stay the same", () => {
    const board = contextWithViews();
    const { rerender } = render(entryPoint(board));
    const first = handed[handed.length - 1];

    rerender(entryPoint({ ...board }));
    const second = handed[handed.length - 1];

    expect(second).not.toBe(first);
    expect(second.runtimes).toBe(first.runtimes);
    expect(second.services).toBe(first.services);
    // Still only the unit's own runtimes.
    expect(second.runtimes.map((rt) => rt.id)).toEqual(["radio.node"]);
  });

  it("follows the board when its runtimes change", () => {
    const board = contextWithViews();
    const { rerender } = render(entryPoint(board));
    const first = handed[handed.length - 1];

    rerender(
      entryPoint({
        ...board,
        runtimes: [...board.runtimes, { id: "library.node" }],
      } as BoardContextState),
    );
    const second = handed[handed.length - 1];

    expect(second.runtimes).not.toBe(first.runtimes);
    expect(second.runtimes.map((rt) => rt.id)).toEqual(["radio.node"]);
  });
});
