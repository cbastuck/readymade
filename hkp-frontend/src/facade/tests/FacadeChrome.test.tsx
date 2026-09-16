import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  BoardCtx,
  type BoardContextState,
} from "hkp-frontend/src/BoardContext";
import FacadeChrome from "../FacadeChrome";
import { FacadeViewProvider } from "../FacadeViewContext";

function boardContext(state: Partial<BoardContextState>): BoardContextState {
  return { runtimes: [], ...state } as BoardContextState;
}

const withFacade = {
  runtimes: [{ id: "ui" }],
  facade: { panels: [] },
} as unknown as Partial<BoardContextState>;

/** The mode is read from storage at mount, as the pair of flags it is kept as. */
function storeMode(mode: "facade" | "split" | "board") {
  localStorage.setItem("hkp-facade-visible-Demo", String(mode !== "board"));
  localStorage.setItem("hkp-facade-runtime-Demo", String(mode !== "facade"));
}

function renderChrome(state: Partial<BoardContextState>) {
  return render(
    <BoardCtx.Provider value={boardContext(state)}>
      <FacadeViewProvider boardName="Demo">
        <FacadeChrome>
          <div data-testid="bar">
            <button type="button">Board menu</button>
          </div>
        </FacadeChrome>
      </FacadeViewProvider>
    </BoardCtx.Provider>,
  );
}

function revealButton() {
  return screen.getByRole("button", { name: "Show the board controls" });
}

function bar() {
  return screen.getByTestId("bar").parentElement!;
}

describe("FacadeChrome", () => {
  beforeEach(() => localStorage.clear());

  it("leaves the bar alone while the board is on screen", () => {
    storeMode("split");
    renderChrome(withFacade);
    expect(
      screen.queryByRole("button", { name: "Show the board controls" }),
    ).toBeNull();
    // Passed straight through: no overlay wrapped around it.
    expect(bar().getAttribute("data-facade-chrome-bar")).toBeNull();
  });

  it("leaves the bar alone for a board with no facade to use", () => {
    storeMode("facade");
    renderChrome({ runtimes: [{ id: "ui" }] } as Partial<BoardContextState>);
    expect(
      screen.queryByRole("button", { name: "Show the board controls" }),
    ).toBeNull();
  });

  it("retracts to the logo while the facade is the whole view", () => {
    storeMode("facade");
    renderChrome(withFacade);
    expect(revealButton()).toBeTruthy();
    expect(bar().style.visibility).toBe("hidden");
  });

  it("floats the retracted mark so the facade keeps the window", () => {
    storeMode("facade");
    renderChrome(withFacade);
    // Out of the flow, so nothing above the facade takes height from it.
    expect(revealButton().style.position).toBe("absolute");
    // On the facade's own ground rather than the window's, which is a
    // different colour and would ring the mark against what it sits on.
    expect(revealButton().style.background).toContain("--background");
  });

  it("brings the bar back when the logo is clicked", () => {
    storeMode("facade");
    renderChrome(withFacade);
    fireEvent.click(revealButton());
    expect(bar().style.visibility).toBe("visible");
  });

  it("puts it away again on a pointer outside it", () => {
    storeMode("facade");
    renderChrome(withFacade);
    fireEvent.click(revealButton());
    fireEvent.pointerDown(document.body);
    expect(bar().style.visibility).toBe("hidden");
  });

  it("puts it away again on Escape", () => {
    storeMode("facade");
    renderChrome(withFacade);
    fireEvent.click(revealButton());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(bar().style.visibility).toBe("hidden");
  });

  it("stays out for a pointer on the bar itself", () => {
    storeMode("facade");
    renderChrome(withFacade);
    fireEvent.click(revealButton());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Board menu" }));
    expect(bar().style.visibility).toBe("visible");
  });

  it("stays out for a pointer in a menu the bar opened elsewhere in the document", () => {
    storeMode("facade");
    renderChrome(withFacade);
    fireEvent.click(revealButton());

    // Radix portals a dropdown's content to the end of the document, so the
    // item under the pointer is not a descendant of the bar.
    const popper = document.createElement("div");
    popper.setAttribute("data-radix-popper-content-wrapper", "");
    const item = document.createElement("div");
    popper.appendChild(item);
    document.body.appendChild(popper);

    fireEvent.pointerDown(item);
    expect(bar().style.visibility).toBe("visible");

    popper.remove();
  });
});
