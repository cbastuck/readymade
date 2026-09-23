import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ScopeOutput from "../ScopeOutput";

/**
 * Whether a scope's answer leaves it, as its panel puts the choice.
 *
 * A board spells this as a boolean, and the panel must not: offering true and
 * false would make a reader work out which way round the name runs before
 * they could answer the question it is asking.
 */

// The control is a Radix select, which reads pointer capture and scrolls the
// option it opens on into view — neither of which jsdom implements.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false) as any;
  Element.prototype.releasePointerCapture = vi.fn() as any;
  Element.prototype.setPointerCapture = vi.fn() as any;
  Element.prototype.scrollIntoView = vi.fn() as any;
});

function choose(option: string) {
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("what leaves a scope", () => {
  it("is said in what it does, not in the board's spelling of it", () => {
    render(<ScopeOutput stops={false} onChange={() => {}} />);
    expect(screen.getByRole("combobox").textContent).toContain("continues");

    render(<ScopeOutput stops onChange={() => {}} />);
    expect(screen.getAllByRole("combobox")[1].textContent).toContain("stops");
  });

  it("answers with the boolean a board keeps", () => {
    const onChange = vi.fn();
    render(<ScopeOutput stops={false} onChange={onChange} />);

    choose("stops");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("turns it back off again", () => {
    const onChange = vi.fn();
    render(<ScopeOutput stops onChange={onChange} />);

    choose("continues");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("reads without a control where a panel cannot configure", () => {
    render(<ScopeOutput stops />);

    expect(screen.getByText("stops")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
