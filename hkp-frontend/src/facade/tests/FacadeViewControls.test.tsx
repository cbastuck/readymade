import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BoardCtx, type BoardContextState } from "hkp-frontend/src/BoardContext";
import FacadeViewControls from "../FacadeViewControls";
import { boardHasFacade, FacadeViewProvider } from "../FacadeViewContext";

function boardContext(state: Partial<BoardContextState>): BoardContextState {
  return { runtimes: [], ...state } as BoardContextState;
}

function renderControls(state: Partial<BoardContextState>) {
  localStorage.clear();
  return render(
    <BoardCtx.Provider value={boardContext(state)}>
      <FacadeViewProvider boardName="Demo">
        <FacadeViewControls />
      </FacadeViewProvider>
    </BoardCtx.Provider>,
  );
}

const withRuntime = {
  runtimes: [{ id: "ui" }],
} as unknown as Partial<BoardContextState>;

const withFacade = {
  runtimes: [{ id: "ui" }],
  facade: { panels: [] },
} as unknown as Partial<BoardContextState>;

function editorButton() {
  return screen.getByRole("button", { name: "Toggle the facade editor" });
}

describe("boardHasFacade", () => {
  beforeEach(() => localStorage.clear());

  it("is false for an empty board", () => {
    expect(boardHasFacade(boardContext({}))).toBe(false);
  });

  it("is false where no provider is mounted at all", () => {
    expect(boardHasFacade(null)).toBe(false);
  });

  it("is true for a board that declares one", () => {
    expect(boardHasFacade(boardContext(withFacade))).toBe(true);
  });

  it("is true for a composition, whose units contribute the views", () => {
    expect(
      boardHasFacade(
        boardContext({
          runtimes: [{ id: "ui" }],
          linkage: { units: [], views: [{ id: "booking" }] },
        } as unknown as Partial<BoardContextState>),
      ),
    ).toBe(true);
  });
});

describe("FacadeViewControls", () => {
  beforeEach(() => localStorage.clear());

  it("says which layout is on screen", () => {
    renderControls(withFacade);
    expect(
      screen
        .getByRole("button", { name: "Show the facade only" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Show the board only" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("offers no layout to choose on a board with no facade", () => {
    renderControls(withRuntime);
    expect(screen.queryByRole("group", { name: "Board view" })).toBe(null);
  });

  it("offers the editor there anyway, because that is where one is started", () => {
    renderControls(withRuntime);
    expect(editorButton().hasAttribute("disabled")).toBe(false);
  });

  it("asks what to look at once the editor is open on such a board", () => {
    renderControls(withRuntime);
    fireEvent.click(editorButton());
    expect(screen.getByRole("group", { name: "Board view" })).toBeDefined();
  });

  it("refuses the editor while there is no board to put a facade on", () => {
    renderControls({});
    expect(editorButton().hasAttribute("disabled")).toBe(true);
  });

  it("offers no layout to choose there either, opened editor or not", () => {
    renderControls({});
    fireEvent.click(editorButton());
    expect(screen.queryByRole("group", { name: "Board view" })).toBe(null);
  });

  it("renders nothing where no provider is mounted", () => {
    const { container } = render(
      <BoardCtx.Provider value={boardContext(withFacade)}>
        <FacadeViewControls />
      </BoardCtx.Provider>,
    );
    expect(container.innerHTML).toBe("");
  });
});
