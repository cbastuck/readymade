import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ScopeSlots from "../ScopeSlots";

/**
 * What a scope's cells look like before anybody asks, and the one thing that
 * can be done to them.
 *
 * A cell holds whatever a pipeline put in it, so what this has to get right is
 * restraint: the section is a line until it is opened, the names are all an
 * open section shows, and a value is drawn only for the cell that was clicked.
 * What the cells hold is the pipelines' to write; what a panel offers is to
 * take one away.
 */

// The control is a Radix select, which reads pointer capture and scrolls the
// option it opens on into view — neither of which jsdom implements.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false) as any;
  Element.prototype.releasePointerCapture = vi.fn() as any;
  Element.prototype.setPointerCapture = vi.fn() as any;
  Element.prototype.scrollIntoView = vi.fn() as any;
});

function renderSlots(cells: [string, unknown][], inherited = false) {
  const onSlotsChange = vi.fn();
  const onRemove = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <ScopeSlots
        cells={cells}
        slots={inherited ? "inherit" : "own"}
        inherited={inherited}
        open={open}
        onOpenChange={setOpen}
        onSlotsChange={onSlotsChange}
        onRemove={onRemove}
      />
    );
  }
  render(<Host />);
  return { onSlotsChange, onRemove };
}

/** Opens the section and the named cell, which is where its value appears. */
function openCell(name: string) {
  fireEvent.click(screen.getByText("Slots"));
  fireEvent.click(screen.getByText(name));
}

const held = [
  ["latest", { triggerCount: 42 }],
  ["draft", "unsent"],
] as [string, unknown][];

describe("a scope's slots", () => {
  it("are a folded line saying how many and whose they are", () => {
    renderSlots(held);

    expect(screen.getByText("· 2")).toBeTruthy();
    expect(screen.getByText("own")).toBeTruthy();
    // Folded means folded: not the values, and not even the names.
    expect(screen.queryByText("latest")).toBeNull();
    expect(screen.queryByText(/triggerCount/)).toBeNull();
  });

  it("open to the names, which is what a board is written in terms of", () => {
    renderSlots(held);
    fireEvent.click(screen.getByText("Slots"));

    expect(screen.getByText("latest")).toBeTruthy();
    expect(screen.getByText("draft")).toBeTruthy();
    // Every value still unasked for.
    expect(screen.queryByText(/triggerCount/)).toBeNull();
  });

  it("show a value only for the cell that was clicked", () => {
    renderSlots(held);
    openCell("latest");

    expect(screen.getByText(/triggerCount/)).toBeTruthy();
    expect(screen.queryByText(/unsent/)).toBeNull();
  });

  it("say inherited cells are not this scope's to account for", () => {
    renderSlots(held, true);

    expect(screen.getByText("inherit")).toBeTruthy();
    fireEvent.click(screen.getByText("Slots"));
    // The grey that says so, per row rather than once in the heading.
    expect(screen.getByText("latest").closest("button")?.className).toContain(
      "text-neutral-400",
    );
  });
});

describe("taking a cell away", () => {
  it("is offered per slot, and named so it can be said aloud", () => {
    // A bin beside the name rather than inside it: opening a cell and
    // removing it are two things to do to one row.
    const { onRemove } = renderSlots(held);
    fireEvent.click(screen.getByText("Slots"));

    fireEvent.click(screen.getByLabelText("Remove latest"));
    expect(onRemove).toHaveBeenCalledWith("latest");
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("does not open the cell it removes", () => {
    // The two controls are siblings, so neither fires the other.
    const { onRemove } = renderSlots(held);
    fireEvent.click(screen.getByText("Slots"));

    fireEvent.click(screen.getByLabelText("Remove draft"));
    expect(onRemove).toHaveBeenCalledWith("draft");
    expect(screen.queryByText(/unsent/)).toBeNull();
  });

  it("is the only thing done to a value, which is read as it is held", () => {
    // Bytes survive being described and not being written down, so what a
    // panel says about them is a description — and nothing here rewrites it.
    renderSlots([["frame", new Uint8Array([1, 2, 3])]]);
    openCell("frame");

    expect(screen.getByText("[3 bytes]")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByLabelText("Remove frame")).toBeTruthy();
  });
});

describe("which cells a scope holds in", () => {
  it("is the one thing here a panel offers to change", () => {
    // A setting, so it wears what every other setting in a service panel
    // wears: the choice is made in the same control, and the trigger reads as
    // where the cells are rather than as something to press.
    const { onSlotsChange } = renderSlots(held, true);

    const control = screen.getByRole("combobox");
    expect(control.textContent).toContain("inherit");

    fireEvent.keyDown(control, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "own" }));
    expect(onSlotsChange).toHaveBeenCalledWith("own");
  });

  it("reads without a control where a panel cannot configure", () => {
    // A panel that reached a scope's cells over REST can show them and not
    // offer to change them; the reading has to survive on its own.
    render(
      <ScopeSlots
        cells={held}
        slots="own"
        inherited={false}
        open
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText("own")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    // Nor is anything offered that would take a cell away.
    expect(screen.queryByLabelText("Remove latest")).toBeNull();
  });
});
