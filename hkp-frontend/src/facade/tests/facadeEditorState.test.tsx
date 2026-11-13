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
    fireEvent.click(within(screen.getByRole("tree")).getByText("State"));
    const panel = screen.getByRole("region", { name: "Facade state" });
    expect(within(panel).getByText("Nothing in facade state yet.")).toBeTruthy();
  });

  it("follows what widgets publish, as they publish it", () => {
    render(<Facade />);
    fireEvent.click(within(screen.getByRole("tree")).getByText("State"));
    const panel = screen.getByRole("region", { name: "Facade state" });
    const value = (key: string) =>
      panel.querySelector(`[data-state-key="${key}"] .hkp-binding-value`)!
        .textContent;

    fireEvent.click(screen.getByText("pick"));
    expect(value("selectedCard")).toBe("7");

    fireEvent.click(screen.getByText("pick rows"));
    expect(JSON.parse(value("picked")!)).toEqual(["a", "b"]);

    // Given up, not forgotten: the key is still one the facade uses.
    fireEvent.click(screen.getByText("let go"));
    expect(value("selectedCard")).toBe("not set");
  });

  it("lets a repeat template's text widget be selected and its color edited", () => {
    let current: FacadeDescriptor = {
      layout: "single",
      panels: [
        {
          id: "news",
          layout: {
            direction: "column",
            items: [
              {
                type: "repeat",
                source: { serviceUuid: "feed", path: "items" },
                template: {
                  direction: "column",
                  items: [
                    {
                      type: "text",
                      placeholder: "{{item.summary}}",
                      tone: "muted",
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const { rerender } = render(
      <FacadeStateContext.Provider value={{ state: {}, setState: () => {} }}>
        <FacadeEditor
          facade={current}
          onChange={(updated) => {
            current = updated;
          }}
        />
      </FacadeStateContext.Provider>,
    );

    fireEvent.click(screen.getByText("text · {{item.summary}}"));
    const colorRow = screen.getByText("color").closest("tr")!;
    fireEvent.click(colorRow.querySelectorAll("td")[1]);
    const input = colorRow.querySelector("input")!;
    fireEvent.change(input, { target: { value: "#1e293b" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const repeat = (current.panels[0].layout as any).items[0];
    expect(repeat.template.items[0].color).toBe("#1e293b");

    rerender(
      <FacadeStateContext.Provider value={{ state: {}, setState: () => {} }}>
        <FacadeEditor
          facade={current}
          onChange={(updated) => {
            current = updated;
          }}
        />
      </FacadeStateContext.Provider>,
    );
    expect(screen.getByText("#1e293b")).toBeTruthy();
  });
});
