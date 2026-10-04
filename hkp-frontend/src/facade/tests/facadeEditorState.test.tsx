import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { FacadeEditor } from "../editor/FacadeEditor";
import { FacadeStateContext, useFacadeState } from "../FacadeStateContext";
import type { FacadeDescriptor } from "../types";

/**
 * Facade state lives only in a facade on screen, so the editor is where it can
 * be looked at: it reads the store the widgets write to, not a copy of it.
 */

const facade: FacadeDescriptor = {
  layout: "single",
  panels: [{ id: "board", layout: { direction: "column", items: [] } }],
};

/** Stands in for a widget publishing what a person picked. */
function Picker() {
  const { setState } = useFacadeState();
  return (
    <>
      <button onClick={() => setState("selectedCard", 7)}>pick</button>
      <button onClick={() => setState("selectedCard", undefined)}>let go</button>
      <button onClick={() => setState("picked", ["a", "b"])}>pick rows</button>
    </>
  );
}

function Facade() {
  const [state, setStateRaw] = useState<Record<string, unknown>>({});
  return (
    <FacadeStateContext.Provider
      value={{
        state,
        setState: (key, value) => setStateRaw((prev) => ({ ...prev, [key]: value })),
      }}
    >
      <Picker />
      <FacadeEditor facade={facade} onChange={() => {}} />
    </FacadeStateContext.Provider>
  );
}

describe("facade state in the editor", () => {
  it("says so while the facade holds none", () => {
    render(<Facade />);
    const panel = screen.getByRole("region", { name: "Facade state" });
    expect(within(panel).getByText("Nothing in facade state yet.")).toBeTruthy();
  });

  it("follows what widgets publish, as they publish it", () => {
    render(<Facade />);
    const panel = screen.getByRole("region", { name: "Facade state" });
    const row = (key: string) => within(panel).getByText(key).closest("tr")!;

    fireEvent.click(screen.getByText("pick"));
    expect(row("selectedCard").textContent).toBe("selectedCard7");

    fireEvent.click(screen.getByText("pick rows"));
    expect(JSON.parse(row("picked").textContent!.replace("picked", ""))).toEqual([
      "a",
      "b",
    ]);

    // Given up, not forgotten: the key is still one the facade uses.
    fireEvent.click(screen.getByText("let go"));
    expect(row("selectedCard").textContent).toBe("selectedCard—");
  });
});
