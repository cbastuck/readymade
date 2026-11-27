import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import PaneSplitter from "../PaneSplitter";

/**
 * The handle between two stacked panes, as the sidebar and the facade editor
 * use it: it reports a height for the pane it resizes, kept within bounds.
 */

function renderSplitter(props: Partial<Parameters<typeof PaneSplitter>[0]> = {}) {
  const onResize = vi.fn();
  const onCommit = vi.fn();
  const onReset = vi.fn();
  render(
    <PaneSplitter
      label="Resize"
      heightOf={() => 100}
      minHeight={60}
      maxHeight={() => 200}
      onResize={onResize}
      onCommit={onCommit}
      onReset={onReset}
      {...props}
    />,
  );
  return { handle: screen.getByRole("separator", { name: "Resize" }), onResize, onCommit, onReset };
}

// jsdom has no PointerEvent; a MouseEvent under the pointer event's name
// carries the coordinates the handler reads.
function drag(handle: HTMLElement, from: number, to: number) {
  handle.dispatchEvent(new MouseEvent("pointerdown", { clientY: from, bubbles: true }));
  window.dispatchEvent(new MouseEvent("pointermove", { clientY: to }));
  window.dispatchEvent(new MouseEvent("pointerup", { clientY: to }));
}

describe("a pane splitter", () => {
  it("grows the pane above as it is dragged down, and remembers where it was let go", () => {
    const { handle, onResize, onCommit } = renderSplitter();
    drag(handle, 300, 330);
    expect(onResize).toHaveBeenLastCalledWith(130);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("shrinks the pane below as it is dragged down", () => {
    const { handle, onResize } = renderSplitter({ resizes: "below" });
    drag(handle, 300, 330);
    expect(onResize).toHaveBeenLastCalledWith(70);
  });

  it("keeps the pane within what the caller allows", () => {
    const { handle, onResize } = renderSplitter();
    drag(handle, 300, 900);
    expect(onResize).toHaveBeenLastCalledWith(200);
    drag(handle, 300, 0);
    expect(onResize).toHaveBeenLastCalledWith(60);
  });

  it("moves with the arrow keys, in the direction of the pane it resizes", () => {
    const { handle, onResize } = renderSplitter({ resizes: "below" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onResize).toHaveBeenLastCalledWith(112);
  });

  it("resets on a double-click", () => {
    const { handle, onReset } = renderSplitter();
    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalled();
  });
});
