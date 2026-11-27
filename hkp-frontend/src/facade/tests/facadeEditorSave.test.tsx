import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import FacadeRenderer from "../FacadeRenderer";
import { FacadeViewProvider, useFacadeView } from "../FacadeViewContext";
import type { FacadeDescriptor } from "../types";

/**
 * What the facade editor changes is the board's facade: handed to the board to
 * be kept, and drawn from what the board then holds.
 */

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
  canReachService: () => true,
  isBuiltInside: () => true,
  whenServiceConnected: async () => {},
}));

const boardContext = {
  scopes: {},
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {},
  runtimeApis: {},
} as unknown as BoardContextState;

const facadeWith = (label: string) =>
  ({
    layout: "single",
    panels: [{ id: "main", layout: { type: "button", label, actions: [] } }],
  }) as unknown as FacadeDescriptor;

function OpenEditor() {
  const view = useFacadeView();
  return (
    <button type="button" onClick={view?.toggleEditor}>
      open editor
    </button>
  );
}

/** A board holding its facade, as BoardContext does. */
function Board({
  initial,
  kept = true,
  onKept = () => {},
}: {
  initial: FacadeDescriptor;
  kept?: boolean;
  onKept?: (facade: FacadeDescriptor) => void;
}) {
  const [facade, setFacade] = useState(initial);
  return (
    <FacadeViewProvider boardName="save-board">
      <OpenEditor />
      <button type="button" onClick={() => setFacade(facadeWith("Changed elsewhere"))}>
        change it elsewhere
      </button>
      <FacadeRenderer
        facade={facade}
        boardContext={boardContext}
        boardName="save-board"
        runtimeContent={null}
        onFacadeChange={
          kept
            ? (updated) => {
                onKept(updated);
                setFacade(updated);
              }
            : undefined
        }
      />
    </FacadeViewProvider>
  );
}

function relabel(to: string) {
  fireEvent.click(screen.getByRole("button", { name: "open editor" }));
  const tree = screen.getByRole("tree", { name: "Facade" });
  fireEvent.click(
    within(tree).getAllByRole("treeitem").find((row) => /button\s+·/.test(row.textContent ?? ""))!,
  );
  const props = screen.getByRole("tabpanel", { name: "Properties" });
  const label = within(props).getByText("label").closest("tr")!;
  fireEvent.click(label.querySelectorAll("td")[1]);
  const field = within(label).getByRole("textbox");
  fireEvent.change(field, { target: { value: to } });
  fireEvent.keyDown(field, { key: "Enter" });
}

beforeEach(() => localStorage.clear());

describe("a change made in the facade editor", () => {
  it("is handed to the board, which is what saving reads", () => {
    const onKept = vi.fn();
    render(<Board initial={facadeWith("Go")} onKept={onKept} />);
    relabel("Make one");
    expect(onKept).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onKept.mock.calls[0][0])).toContain("Make one");
    expect(screen.getByRole("button", { name: "Make one" })).toBeTruthy();
  });

  it("gives way to a change the board's facade took from elsewhere", () => {
    render(<Board initial={facadeWith("Go")} />);
    fireEvent.click(screen.getByRole("button", { name: "change it elsewhere" }));
    expect(screen.getByRole("button", { name: "Changed elsewhere" })).toBeTruthy();
  });

  it("is said not to be saved where nothing keeps it", () => {
    render(<Board initial={facadeWith("Go")} kept={false} />);
    relabel("Make one");
    // Still shown, for as long as the board is open.
    expect(screen.getByRole("button", { name: "Make one" })).toBeTruthy();
    expect(screen.getByText(/not saved with the board/)).toBeTruthy();
  });
});
