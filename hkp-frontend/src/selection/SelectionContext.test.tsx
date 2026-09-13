import { fireEvent, render, screen } from "@testing-library/react";

import { SelectionProvider, useSelection } from "./SelectionContext";

function Readout() {
  const selection = useSelection();
  return (
    <>
      <div data-testid="selected">{selection?.selectedRuntimeId ?? ""}</div>
      <button onClick={() => selection?.selectRuntime("node")}>pick node</button>
    </>
  );
}

function renderWith(runtimeIds: string[]) {
  const view = render(
    <SelectionProvider runtimeIds={runtimeIds}>
      <Readout />
    </SelectionProvider>,
  );
  return (ids: string[]) =>
    view.rerender(
      <SelectionProvider runtimeIds={ids}>
        <Readout />
      </SelectionProvider>,
    );
}

const selected = () => screen.getByTestId("selected").textContent;

describe("SelectionProvider", () => {
  it("selects nothing while the board has no runtimes", () => {
    renderWith([]);
    expect(selected()).toBe("");
  });

  it("selects the first runtime a board arrives with", () => {
    renderWith(["ui", "node"]);
    expect(selected()).toBe("ui");
  });

  it("selects the first runtime added to an empty board", () => {
    const rerender = renderWith([]);
    rerender(["ui"]);
    expect(selected()).toBe("ui");
  });

  it("keeps what was picked when the board gains a runtime", () => {
    const rerender = renderWith(["ui", "node"]);
    fireEvent.click(screen.getByText("pick node"));
    expect(selected()).toBe("node");

    rerender(["ui", "node", "python"]);
    expect(selected()).toBe("node");
  });

  it("falls back to the first runtime once the picked one is gone", () => {
    const rerender = renderWith(["ui", "node"]);
    fireEvent.click(screen.getByText("pick node"));

    rerender(["ui"]);
    expect(selected()).toBe("ui");
  });

  it("returns to what was picked when that runtime comes back", () => {
    const rerender = renderWith(["ui", "node"]);
    fireEvent.click(screen.getByText("pick node"));
    rerender(["ui"]);

    rerender(["ui", "node"]);
    expect(selected()).toBe("node");
  });
});
